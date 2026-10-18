import prisma from '@/lib/db';
import CartClient, { type CartShippingInfo } from './CartClient';

export const dynamic = 'force-dynamic';

/**
 * El carrito vive en el cliente (localStorage), pero la estimación de envío
 * sale del método por defecto configurado en /admin/shipping — el mismo que
 * preselecciona el checkout (primer método activo por `sort_order`).
 */
export default async function CartPage() {
    const method = await prisma.shippingMethod.findFirst({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
        select: { price: true, free_above: true }
    });

    const shipping: CartShippingInfo | null = method
        ? { price: Number(method.price), freeAbove: method.free_above !== null ? Number(method.free_above) : null }
        : null;

    return <CartClient shipping={shipping} />;
}
