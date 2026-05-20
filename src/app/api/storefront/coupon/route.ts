import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { resolveCoupon } from '@/lib/coupons';
import { rateLimit } from '@/lib/rate-limit';
import { couponDryRunSchema } from '@/lib/schemas';

/**
 * Validación previa de cupón (dry-run): el frontend lo invoca al pulsar
 * "Aplicar" en el checkout para mostrar al usuario el descuento estimado
 * antes de finalizar la compra. NO consume `used_count` — eso ocurre dentro
 * del POST /api/storefront/checkout, atómicamente con la creación de la
 * orden. Por eso un cupón validado aquí podría agotarse antes del checkout
 * real (caso poco probable que el endpoint de checkout maneja con HTTP 409).
 */
export async function POST(req: Request) {
    try {
        const limit = rateLimit(req, { bucket: 'coupon-validate', max: 20, windowMs: 60_000 });
        if (!limit.ok) {
            return NextResponse.json(
                { error: 'Demasiados intentos. Inténtalo más tarde.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
            );
        }

        const body = await req.json().catch(() => null);
        const parsed = couponDryRunSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || 'Datos inválidos.' },
                { status: 400 }
            );
        }
        const { code, subtotal } = parsed.data;

        const { coupon, discount } = await resolveCoupon(prisma, code, subtotal);
        return NextResponse.json({
            success: true,
            code: coupon.code,
            discount,
            discount_type: coupon.discount_type,
            discount_value: Number(coupon.discount_value),
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Cupón no válido.' }, { status: 400 });
    }
}
