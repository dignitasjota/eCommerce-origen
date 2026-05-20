interface StatusInfo {
    label: string;
    color: string;
    message: string;
}

const STATUS: Record<string, StatusInfo> = {
    REQUESTED: {
        label: 'Solicitada',
        color: '#92400e',
        message: 'Hemos recibido tu solicitud de devolución. La revisaremos y te avisaremos cuanto antes.'
    },
    APPROVED: {
        label: 'Aprobada',
        color: '#1d4ed8',
        message: 'Tu devolución está aprobada. Envíanos los productos a la dirección indicada y procesaremos el reembolso al recibirlos.'
    },
    REJECTED: {
        label: 'Rechazada',
        color: '#b91c1c',
        message: 'Lamentablemente no podemos aceptar esta devolución. Si crees que es un error, responde a este correo.'
    },
    RECEIVED: {
        label: 'Recibida',
        color: '#4338ca',
        message: 'Hemos recibido los productos devueltos. El reembolso se procesará en los próximos días hábiles.'
    },
    REFUNDED: {
        label: 'Reembolsada',
        color: '#047857',
        message: 'El reembolso se ha procesado. Puede tardar varios días en aparecer en tu cuenta según tu banco.'
    },
    CANCELLED: {
        label: 'Cancelada',
        color: '#6b7280',
        message: 'Tu solicitud de devolución ha sido cancelada.'
    }
};

export const getReturnStatusEmailHtml = (
    returnNumber: string,
    customerName: string,
    newStatus: string,
    extras?: { adminNotes?: string | null; refundAmount?: number | null }
) => {
    const info = STATUS[newStatus] || STATUS.REQUESTED;
    const safeNum = (returnNumber || '').replace(/[<>]/g, '');
    const safeName = (customerName || 'Cliente').replace(/[<>]/g, '');
    const refundLine =
        newStatus === 'REFUNDED' && extras?.refundAmount
            ? `<p style="text-align:center;font-size:18px;font-weight:bold;color:#047857;">Importe reembolsado: ${extras.refundAmount.toFixed(2)} €</p>`
            : '';
    const notesBlock =
        (newStatus === 'REJECTED' || newStatus === 'APPROVED') && extras?.adminNotes
            ? `<div style="margin:20px 0;padding:12px;background:#f9fafb;border-left:4px solid ${info.color};border-radius:4px;">
                <strong>Notas:</strong><br>${extras.adminNotes.replace(/[<>]/g, '').replace(/\n/g, '<br>')}
               </div>`
            : '';
    return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #eaeaea;border-radius:8px;">
        <h2 style="color:#333;text-align:center;border-bottom:2px solid ${info.color};padding-bottom:10px;">Tu devolución</h2>
        <p style="color:#555;font-size:16px;">Hola <strong>${safeName}</strong>,</p>
        <p style="color:#555;font-size:16px;">Tu devolución <strong>#${safeNum}</strong> está en estado:</p>
        <div style="text-align:center;margin:30px 0;">
            <span style="display:inline-block;padding:12px 24px;background:${info.color}22;color:${info.color};font-weight:bold;font-size:18px;border-radius:6px;border:1px solid ${info.color}55;">
                ${info.label.toUpperCase()}
            </span>
        </div>
        <p style="color:#555;font-size:15px;text-align:center;">${info.message}</p>
        ${refundLine}
        ${notesBlock}
        <p style="color:#aaa;font-size:12px;text-align:center;margin-top:40px;">© ${new Date().getFullYear()} eShop.</p>
    </div>`;
};
