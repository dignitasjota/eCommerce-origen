import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /api/storefront/wishlist - Obtener la lista de deseos del usuario activo
export async function GET(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const wishlistItems = await prisma.wishlistItem.findMany({
            where: {
                user_id: session.user.id
            },
            include: {
                products: {
                    include: {
                        product_translations: true,
                        product_images: {
                            orderBy: { sort_order: 'asc' },
                            take: 1
                        }
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        // Formatear para el frontend de forma limpia
        const formattedItems = wishlistItems.map(item => {
            const product = item.products;
            // Para idiomas simplificado, cogemos la primera traducción disponible o el default 'es'
            const translation = product.product_translations[0];
            const image = product.product_images.length > 0 ? product.product_images[0].url : null;

            return {
                wishlist_id: item.id,
                product_id: product.id,
                slug: product.slug,
                name: translation?.name || 'Producto sin nombre',
                price: Number(product.price),
                image: image,
                is_active: product.is_active
            };
        });

        return NextResponse.json(formattedItems);

    } catch (error: any) {
        console.error('Error fetching wishlist:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}

// POST /api/storefront/wishlist - Añadir o Quitar de la lista de deseos (Toggle)
export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Debes iniciar sesión para añadir a favoritos' }, { status: 401 });
        }

        const body = await request.json();
        const { productId } = body;

        if (!productId) {
            return NextResponse.json({ error: 'ID de producto requerido' }, { status: 400 });
        }

        // Verificar si el producto existe
        const productExists = await prisma.product.findUnique({
            where: { id: productId }
        });

        if (!productExists) {
            return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
        }

        // Buscar si ya está en la wishlist
        const existingItem = await prisma.wishlistItem.findUnique({
            where: {
                user_id_product_id: {
                    user_id: session.user.id,
                    product_id: productId
                }
            }
        });

        if (existingItem) {
            // Si existe, lo eliminamos (Toggle - Remove)
            await prisma.wishlistItem.delete({
                where: { id: existingItem.id }
            });
            return NextResponse.json({ action: 'removed', success: true });
        } else {
            // Si no existe, lo añadimos (Toggle - Add)
            await prisma.wishlistItem.create({
                data: {
                    user_id: session.user.id,
                    product_id: productId
                }
            });
            return NextResponse.json({ action: 'added', success: true });
        }

    } catch (error: any) {
        console.error('Error updating wishlist:', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
