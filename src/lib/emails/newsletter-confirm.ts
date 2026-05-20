export const getNewsletterConfirmEmailHtml = (confirmUrl: string, siteName: string) => {
    const safeUrl = confirmUrl.replace(/[<>"']/g, '');
    const safeSite = (siteName || 'eShop').replace(/[<>]/g, '');
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="color: #333; text-align: center; border-bottom: 2px solid #6366f1; padding-bottom: 10px;">Confirma tu suscripción</h2>
        <p style="color: #555; font-size: 16px;">Casi has terminado. Pulsa el botón para confirmar que quieres recibir las novedades de <strong>${safeSite}</strong>:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="${safeUrl}" style="display: inline-block; padding: 14px 28px; background: #6366f1; color: #fff; text-decoration: none; font-weight: bold; border-radius: 6px;">Confirmar suscripción</a>
        </div>
        <p style="color: #777; font-size: 13px; text-align: center;">Si no fuiste tú, ignora este correo: tu email no se añadirá a la lista.</p>
        <p style="color: #aaa; font-size: 12px; text-align: center; margin-top: 30px;">© ${new Date().getFullYear()} ${safeSite}.</p>
    </div>`;
};
