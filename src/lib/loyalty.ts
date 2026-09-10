import type { Prisma, PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface LoyaltySettings {
    enabled: boolean;
    /** Puntos otorgados por cada € gastado (redondeado hacia abajo). */
    pointsPerEuro: number;
    /** Valor de 1 punto al canjearlo, en céntimos. */
    pointValueCents: number;
}

const DEFAULT_SETTINGS: LoyaltySettings = { enabled: false, pointsPerEuro: 1, pointValueCents: 1 };

export async function getLoyaltySettings(db: PrismaClient | Prisma.TransactionClient): Promise<LoyaltySettings> {
    const rows = await db.siteSetting.findMany({
        where: { key: { in: ['loyalty_enabled', 'loyalty_points_per_euro', 'loyalty_point_value_cents'] } }
    });
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    const pointsPerEuro = Number(map['loyalty_points_per_euro']);
    const pointValueCents = Number(map['loyalty_point_value_cents']);

    return {
        enabled: map['loyalty_enabled'] === 'true',
        pointsPerEuro: Number.isFinite(pointsPerEuro) && pointsPerEuro > 0 ? pointsPerEuro : DEFAULT_SETTINGS.pointsPerEuro,
        pointValueCents: Number.isFinite(pointValueCents) && pointValueCents > 0 ? pointValueCents : DEFAULT_SETTINGS.pointValueCents
    };
}

/**
 * Otorga puntos por un pedido que acaba de quedar PAID. Debe llamarse DENTRO
 * de la misma transacción que confirma el pago (webhook de Stripe o
 * `updateOrderFullStatus` en el admin).
 *
 * Idempotencia: comprueba que no exista ya una transacción EARN para este
 * `orderId` antes de crear una. No hay UNIQUE a nivel de índice sobre
 * `order_id` (una misma orden también puede tener luego un REVERSAL) — la
 * protección real contra doble-abono viene de más arriba: el webhook sólo
 * entra aquí una vez por evento único de Stripe (`WebhookEvent`) y
 * `updateOrderFullStatus` sólo llama a esto en una transición real
 * (`payment_status` pasando de "no PAID" a "PAID"), no en cada guardado.
 */
export async function awardPointsForOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    userId: string | null,
    total: number
): Promise<void> {
    if (!userId) return; // checkout de invitado: no hay cuenta a la que abonar puntos

    const settings = await getLoyaltySettings(tx);
    if (!settings.enabled) return;

    const existing = await tx.loyaltyTransaction.findFirst({ where: { order_id: orderId, type: 'EARN' } });
    if (existing) return;

    const points = Math.floor(total * settings.pointsPerEuro);
    if (points <= 0) return;

    await tx.loyaltyTransaction.create({
        data: { user_id: userId, type: 'EARN', points, order_id: orderId }
    });
    await tx.user.update({ where: { id: userId }, data: { loyalty_points: { increment: points } } });
}

/**
 * Revierte los puntos otorgados por un pedido cuando se reembolsa por
 * completo — sin esto, un cliente podría ganar puntos, pedir la devolución
 * del dinero y quedarse igualmente con los puntos. No deja el saldo en
 * negativo: si el cliente ya canjeó esos puntos, sólo se descuenta lo que
 * le quede disponible.
 */
export async function reversePointsForOrder(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const earn = await tx.loyaltyTransaction.findFirst({ where: { order_id: orderId, type: 'EARN' } });
    if (!earn) return;

    const alreadyReversed = await tx.loyaltyTransaction.findFirst({ where: { order_id: orderId, type: 'REVERSAL' } });
    if (alreadyReversed) return;

    const user = await tx.user.findUnique({ where: { id: earn.user_id }, select: { loyalty_points: true } });
    const toDeduct = Math.min(earn.points, user?.loyalty_points ?? 0);
    if (toDeduct <= 0) return;

    await tx.loyaltyTransaction.create({
        data: { user_id: earn.user_id, type: 'REVERSAL', points: -toDeduct, order_id: orderId, note: 'Reembolso total del pedido' }
    });
    await tx.user.update({ where: { id: earn.user_id }, data: { loyalty_points: { decrement: toDeduct } } });
}

function generateCouponCode(): string {
    return `PTS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/**
 * Canjea puntos por un cupón de descuento fijo de un solo uso, utilizable
 * en el checkout normal (reutiliza toda la infraestructura de cupones ya
 * existente — validación, atomicidad de `used_count`, etc. — en vez de
 * tocar el flujo de checkout para añadir un segundo mecanismo de descuento).
 *
 * Atómico: decremento del saldo con guardia (`updateMany` con
 * `loyalty_points >= pointsToRedeem`) + creación del cupón + registro de la
 * transacción, todo en una única transacción de Prisma.
 */
export async function redeemPointsForCoupon(db: PrismaClient, userId: string, pointsToRedeem: number) {
    if (!Number.isInteger(pointsToRedeem) || pointsToRedeem <= 0) {
        throw new Error('Cantidad de puntos inválida.');
    }

    const settings = await getLoyaltySettings(db);
    if (!settings.enabled) {
        throw new Error('El programa de fidelización no está activo.');
    }

    const discountValue = Math.round(pointsToRedeem * settings.pointValueCents) / 100;
    if (discountValue <= 0) {
        throw new Error('Esa cantidad de puntos no genera ningún descuento.');
    }

    return db.$transaction(async (tx) => {
        const guarded = await tx.user.updateMany({
            where: { id: userId, loyalty_points: { gte: pointsToRedeem } },
            data: { loyalty_points: { decrement: pointsToRedeem } }
        });
        if (guarded.count !== 1) {
            throw new Error('No tienes suficientes puntos.');
        }

        const code = generateCouponCode();
        const coupon = await tx.coupon.create({
            data: {
                code,
                discount_type: 'FIXED',
                discount_value: discountValue,
                max_uses: 1,
                is_active: true
            }
        });

        await tx.loyaltyTransaction.create({
            data: {
                user_id: userId,
                type: 'REDEEM',
                points: -pointsToRedeem,
                coupon_id: coupon.id,
                note: `Canjeado por el cupón ${code}`
            }
        });

        return coupon;
    });
}
