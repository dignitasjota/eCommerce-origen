import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { createReviewSchema } from '@/lib/schemas';
import { saveUploadedImage, InvalidImageUploadError } from '@/lib/uploads';

const MAX_REVIEW_IMAGES = 5;

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

        const formData = await request.formData().catch(() => null);
        if (!formData) {
            return NextResponse.json({ error: 'Datos de la reseña inválidos o incompletos.' }, { status: 400 });
        }

        const ratingRaw = formData.get('rating');
        const parsed = createReviewSchema.safeParse({
            productId: formData.get('productId'),
            rating: typeof ratingRaw === 'string' ? Number(ratingRaw) : ratingRaw,
            title: formData.get('title') || undefined,
            comment: formData.get('comment') || undefined
        });
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.issues[0]?.message || 'Datos de la reseña inválidos o incompletos.' },
                { status: 400 }
            );
        }
        const { productId, rating, title, comment } = parsed.data;

        // Sólo archivos reales (un input file vacío puede llegar como entrada
        // vacía en FormData según el navegador) — filtramos por tamaño > 0.
        const imageFiles = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
        if (imageFiles.length > MAX_REVIEW_IMAGES) {
            return NextResponse.json({ error: `Puedes adjuntar como máximo ${MAX_REVIEW_IMAGES} imágenes.` }, { status: 400 });
        }

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

        // 3. Subir las imágenes adjuntas (si las hay) — whitelist MIME + magic
        // bytes reales + nombre generado en servidor, igual que el resto de
        // subidas de la app (ver src/lib/uploads.ts). Si una falla, se aborta
        // toda la reseña en vez de guardarla con fotos a medias.
        let imageUrls: string[] = [];
        if (imageFiles.length > 0) {
            try {
                imageUrls = await Promise.all(
                    imageFiles.map((file) => saveUploadedImage(file, { subdir: 'reviews', prefix: 'review' }))
                );
            } catch (e) {
                if (e instanceof InvalidImageUploadError) {
                    return NextResponse.json({ error: e.message }, { status: 400 });
                }
                throw e;
            }
        }

        // 4. Crear la Reseña pendiente de aprobación
        // title/comment ya vienen trim()eados (o null) por el schema Zod.
        // is_verified_purchase queda en true porque el paso 1 ya comprobó una
        // compra PAID real del mismo producto — es la única vía para crear
        // una reseña en este endpoint, así que el campo es siempre fiel.
        const newReview = await prisma.review.create({
            data: {
                user_id: session.user.id,
                product_id: productId,
                rating: Number(rating),
                title: title || null,
                comment: comment || null,
                images: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
                is_verified_purchase: true,
                is_approved: false // Moderación activa por defecto
            }
        });

        return NextResponse.json({ success: true, message: '¡Gracias por tu reseña! Será publicada tras su moderación.', reviewId: newReview.id }, { status: 201 });

    } catch (error) {
        console.error('Error enviando reseña:', error);
        return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
    }
}
