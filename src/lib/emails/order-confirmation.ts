export const getOrderConfirmationEmailHtml = (orderId: string, customerName: string, items: any[], total: number) => {
    const itemsHtml = items.map(item => `
        <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.product_name || 'Producto'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${item.price.toFixed(2)}€</td>
        </tr>
    `).join('');

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="color: #333; text-align: center; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">¡Gracias por tu compra, ${customerName}!</h2>
        <p style="color: #555; font-size: 16px;">Hemos recibido tu pedido <strong>#${orderId.slice(0, 8)}</strong> exitosamente y estamos preparándolo para el envío.</p>
        
        <h3 style="color: #444; margin-top: 30px;">Resumen de tu pedido</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
                <tr style="background-color: #f9fafb;">
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Producto</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #ddd;">Cant.</th>
                    <th style="padding: 10px; text-align: right; border-bottom: 2px solid #ddd;">Precio</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold;">Total Pagado:</td>
                    <td style="padding: 10px; text-align: right; font-weight: bold; color: #6366f1;">${total.toFixed(2)}€</td>
                </tr>
            </tfoot>
        </table>

        <p style="color: #777; font-size: 14px; text-align: center; margin-top: 40px;">Recibirás otro correo cuando tu pedido haya sido enviado. ¡Esperamos que lo disfrutes!</p>
        <p style="color: #aaa; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} eShop. Todos los derechos reservados.</p>
    </div>
    `;
};
