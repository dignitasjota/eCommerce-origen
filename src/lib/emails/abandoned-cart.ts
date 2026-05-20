interface CartItemForEmail {
    name: string;
    quantity: number;
    image?: string | null;
    price: number;
}

export const getAbandonedCartEmailHtml = (
    customerName: string,
    items: CartItemForEmail[],
    cartUrl: string,
    siteName: string
) => {
    const safeName = (customerName || 'Cliente').replace(/[<>]/g, '');
    const safeSite = (siteName || 'eShop').replace(/[<>]/g, '');
    const safeUrl = cartUrl.replace(/[<>"']/g, '');

    const itemsHtml = items
        .slice(0, 5)
        .map(
            (it) => `
        <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                <strong>${it.name.replace(/[<>]/g, '')}</strong>
                <div style="color:#777; font-size: 13px;">Cantidad: ${it.quantity}</div>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee; text-align: right; white-space: nowrap;">
                ${(it.price * it.quantity).toFixed(2)} €
            </td>
        </tr>`
        )
        .join('');

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="color: #333; text-align: center; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">${safeName}, te dejaste algo en el carrito 🛒</h2>
        <p style="color: #555; font-size: 16px;">Has añadido productos a tu carrito en <strong>${safeSite}</strong> pero no completaste tu pedido. Te los guardamos para que puedas volver cuando quieras.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tbody>${itemsHtml}</tbody>
        </table>

        <div style="text-align: center; margin: 30px 0;">
            <a href="${safeUrl}" style="display: inline-block; padding: 14px 28px; background: #6366f1; color: #fff; text-decoration: none; font-weight: bold; border-radius: 6px;">Volver al carrito</a>
        </div>

        <p style="color: #777; font-size: 13px; text-align: center;">Si ya has terminado tu compra o no estás interesado, ignora este correo.</p>
        <p style="color: #aaa; font-size: 12px; text-align: center; margin-top: 30px;">© ${new Date().getFullYear()} ${safeSite}.</p>
    </div>`;
};
