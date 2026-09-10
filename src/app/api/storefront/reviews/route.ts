import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { createReviewSchema } from '@/lib/schemas';

export async function POST(request: NextRequest) {
    try {
        const limit = rateLimit(request, { bucket: 'reviews', max: 5, windowMs: 10 * 60_000 });
        if (!limit.ok) {
            return NextResponse.json(
                { error: 'Demasiadas reseñas enviadas. Inténtalo más tarde.' },
                { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
            );
        }

        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Debes iniciar sesión para publicar una reseña.' }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        const parsed = createReviewSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || 'Datos de la reseña inválidos o incompletos.' },
                { status: 400 }
            );
        }
        const { productId, rating, title, comment } = parsed.data;

        // 1. Validar que el usuario realmente compró (y pagó) este producto.
        // Antes no filtraba payment_status: un pedido CANCELLED o PENDING sin
        // pagar también habilitaba a reseñar. `payment_status: 'PAID'` excluye
        // también los reembolsados (el webhook los pasa a REFUNDED, nunca
        // se quedan en PAID) — coincide con lo que ya documenta CLAUDE.md
        // para `is_verified_purchase` ("auto-true si hay OrderItem PAID").
        const userHasPurchased = await prisma.order.findFirst({
            where: {
                user_id: session.user.id,
                payment_status: 'PAID',
                order_items: {
                    some: {
                        product_id: productId
                    }
                }
            }
        });

        if (!userHasPurchased) {
            return NextResponse.json({ error: 'Solo los clientes verificados que hayan comprado este producto pueden escribir una reseña.' }, { status: 403 });
        }

        // 2. Comprobar que no haya publicado ya una reseña para este mismo producto
        const existingReview = await prisma.review.findUnique({
            where: {
                user_id_product_id: {
                    user_id: session.user.id,
                    product_id: productId
                }
            }
        });

        if (existingReview) {
            return NextResponse.json({ error: 'Ya has publicado una reseña para este producto.' }, { status: 409 });
        }

        // 3. Crear la Reseña pendiente de aprobación
        // title/comment ya vienen trim()eados (o null) por el schema Zod.
        const newReview = await prisma.review.create({
            data: {
                user_id: session.user.id,
                product_id: productId,
                rating: Number(rating),
                title: title || null,
                comment: comment || null,
                is_approved: false // Moderación activa por defecto
            }
        });

        return NextResponse.json({ success: true, message: '¡Gracias por tu reseña! Será publicada tras su moderación.', reviewId: newReview.id }, { status: 201 });

    } catch (error: any) {
        console.error('Error enviando reseña:', error);
        return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
    }
}
