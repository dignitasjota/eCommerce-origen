interface StatusInfo {
    label: string;
    bgColor: string;
    color: string;
    borderColor: string;
    message: string;
}

const STATUS_MAP: Record<string, StatusInfo> = {
    PENDING: {
        label: 'Pendiente',
        bgColor: '#fef3c7',
        color: '#92400e',
        borderColor: '#fcd34d',
        message: 'Hemos recibido tu pedido y lo revisaremos en breve.'
    },
    CONFIRMED: {
        label: 'Confirmado',
        bgColor: '#ecfdf5',
        color: '#047857',
        borderColor: '#a7f3d0',
        message: 'Tu pedido ha sido confirmado. Lo prepararemos lo antes posible.'
    },
    PROCESSING: {
        label: 'En preparación',
        bgColor: '#eff6ff',
        color: '#1d4ed8',
        borderColor: '#bfdbfe',
        message: 'Tu pedido se está empaquetando.'
    },
    SHIPPED: {
        label: 'Enviado',
        bgColor: '#eef2ff',
        color: '#4338ca',
        borderColor: '#c7d2fe',
        message: 'Tu pedido ha salido. Te avisaremos cuando esté entregado.'
    },
    DELIVERED: {
        label: 'Entregado',
        bgColor: '#ecfdf5',
        color: '#047857',
        borderColor: '#a7f3d0',
        message: '¡Disfruta tu compra! Si todo ha ido bien, nos encantaría leer tu reseña.'
    },
    CANCELLED: {
        label: 'Cancelado',
        bgColor: '#fee2e2',
        color: '#b91c1c',
        borderColor: '#fecaca',
        message: 'Tu pedido ha sido cancelado. Si fue un error, contacta con nosotros.'
    },
    REFUNDED: {
        label: 'Reembolsado',
        bgColor: '#fef3c7',
        color: '#92400e',
        borderColor: '#fcd34d',
        message: 'Hemos procesado el reembolso de tu pedido. Puede tardar varios días en reflejarse en tu cuenta.'
    }
};

export const getOrderStatusUpdateEmailHtml = (
    orderNumber: string,
    customerName: string,
    newStatus: string,
    extras?: { trackingNumber?: string | null }
) => {
    const info = STATUS_MAP[newStatus] || STATUS_MAP.PENDING;
    const safeOrder = (orderNumber || '').replace(/[<>]/g, '');
    const safeName = (customerName || 'Cliente').replace(/[<>]/g, '');

    const trackingBlock =
        newStatus === 'SHIPPED' && extras?.trackingNumber
            ? `<p style="color: #555; text-align: center; font-size: 15px;">
                 Número de seguimiento: <strong>${extras.trackingNumber.replace(/[<>]/g, '')}</strong>
               </p>`
            : '';

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="color: #333; text-align: center; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">Actualización de tu pedido</h2>

        <p style="color: #555; font-size: 16px;">Hola <strong>${safeName}</strong>,</p>
        <p style="color: #555; font-size: 16px;">El estado de tu pedido <strong>#${safeOrder}</strong> es ahora:</p>

        <div style="text-align: center; margin: 30px 0;">
            <span style="display: inline-block; padding: 12px 24px; background-color: ${info.bgColor}; color: ${info.color}; font-weight: bold; font-size: 18px; border-radius: 6px; border: 1px solid ${info.borderColor};">
                ${info.label.toUpperCase()}
            </span>
        </div>

        <p style="color: #555; font-size: 15px; text-align: center;">${info.message}</p>
        ${trackingBlock}

        <p style="color: #777; font-size: 14px; text-align: center; margin-top: 40px;">Si tienes alguna pregunta, responde a este correo y te ayudamos.</p>
        <p style="color: #aaa; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} eShop. Todos los derechos reservados.</p>
    </div>
    `;
};
