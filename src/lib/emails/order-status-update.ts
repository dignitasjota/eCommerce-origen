export const getOrderStatusUpdateEmailHtml = (orderId: string, customerName: string, newStatus: string) => {

    // Status translation map to Spanish
    const statusMap: Record<string, string> = {
        'PENDING': 'Pendiente',
        'CONFIRMED': 'Confirmado',
        'PROCESSING': 'En Preparación',
        'SHIPPED': 'Enviado',
        'DELIVERED': 'Entregado',
        'CANCELLED': 'Cancelado'
    };

    const displayStatus = statusMap[newStatus] || newStatus;

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="color: #333; text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 10px;">Actualización de tu pedido</h2>
        
        <p style="color: #555; font-size: 16px;">Hola <strong>${customerName}</strong>,</p>
        <p style="color: #555; font-size: 16px;">Queríamos informarte que el estado de tu pedido <strong>#${orderId.slice(0, 8)}</strong> se ha actualizado a:</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <span style="display: inline-block; padding: 12px 24px; background-color: #ecfdf5; color: #047857; font-weight: bold; font-size: 18px; border-radius: 6px; border: 1px solid #a7f3d0;">
                ${displayStatus.toUpperCase()}
            </span>
        </div>

        <p style="color: #777; font-size: 14px; text-align: center; margin-top: 40px;">Si tienes alguna pregunta sobre este cambio, no dudes en contactar a nuestro equipo de soporte respondiendo directamente a este correo.</p>
        <p style="color: #aaa; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} eShop. Todos los derechos reservados.</p>
    </div>
    `;
};
