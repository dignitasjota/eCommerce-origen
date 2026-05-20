import type { Prisma, PrismaClient, Coupon } from '@prisma/client';

export interface ResolvedCoupon {
    coupon: Coupon;
    discount: number;
}

/**
 * Resuelve un código de cupón contra el subtotal indicado y calcula el
 * descuento aplicable. Es una función PURA: no muta DB ni incrementa
 * `used_count`. El consumidor (checkout) debe llamar a `consumeCoupon`
 * dentro de una transacción para registrar el uso de forma atómica.
 *
 * Lanza Error con mensaje legible si el cupón no es aplicable.
 */
export async function resolveCoupon(
    db: PrismaClient | Prisma.TransactionClient,
    code: string,
    subtotal: number
): Promise<ResolvedCoupon> {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
        throw new Error('Código de cupón vacío.');
    }

    const coupon = await db.coupon.findUnique({ where: { code: normalized } });
    if (!coupon || !coupon.is_active) {
        throw new Error('Cupón no válido.');
    }

    const now = new Date();
    if (coupon.starts_at && coupon.starts_at > now) {
        throw new Error('Este cupón aún no está disponible.');
    }
    if (coupon.expires_at && coupon.expires_at < now) {
        throw new Error('Este cupón ha caducado.');
    }
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
        throw new Error('Este cupón ha alcanzado su límite de usos.');
    }
    if (coupon.min_purchase !== null && subtotal < Number(coupon.min_purchase)) {
        const min = Number(coupon.min_purchase).toFixed(2);
        throw new Error(`Compra mínima de ${min} € para este cupón.`);
    }

    let discount =
        coupon.discount_type === 'PERCENTAGE'
            ? subtotal * (Number(coupon.discount_value) / 100)
            : Number(coupon.discount_value);

    // Acotar a [0, subtotal] para que el descuento no haga el total negativo.
    if (discount < 0) discount = 0;
    if (discount > subtotal) discount = subtotal;

    // Redondear a céntimos para evitar drift de float.
    discount = Math.round(discount * 100) / 100;

    return { coupon, discount };
}

/**
 * Incremento atómico de `used_count` con guardia. Devuelve `true` si el cupón
 * se pudo consumir; `false` si en la condición de carrera otro pedido ya agotó
 * los usos disponibles. Llamar SIEMPRE dentro de la misma transacción que
 * crea la orden.
 */
export async function consumeCoupon(
    tx: Prisma.TransactionClient,
    coupon: Coupon
): Promise<boolean> {
    const where: Prisma.CouponWhereInput =
        coupon.max_uses !== null
            ? { id: coupon.id, used_count: { lt: coupon.max_uses } }
            : { id: coupon.id };

    const result = await tx.coupon.updateMany({
        where,
        data: { used_count: { increment: 1 } }
    });

    return result.count === 1;
}
