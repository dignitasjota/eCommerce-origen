export const getPasswordResetEmailHtml = (customerName: string, resetUrl: string) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
        <h2 style="color: #333; text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 10px;">Recuperación de Contraseña</h2>
        
        <p style="color: #555; font-size: 16px;">Hola <strong>${customerName || 'Cliente'}</strong>,</p>
        <p style="color: #555; font-size: 16px;">Hemos recibido una solicitud para restablecer la contraseña asociada a tu cuenta de eShop. Si no fuiste tú quien solicitó este cambio, puedes ignorar de forma segura este correo y tu cuenta seguirá protegida.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #6366f1; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px; border-radius: 6px;">
                Restablecer Contraseña
            </a>
        </div>

        <p style="color: #777; font-size: 14px; text-align: center; margin-top: 30px;">
            Este enlace expira por seguridad en algunas horas. Si el botón no funciona, copia y pega la siguiente URL en tu navegador:<br><br>
            <a href="${resetUrl}" style="color: #6366f1; word-break: break-all;">${resetUrl}</a>
        </p>

        <p style="color: #aaa; font-size: 12px; text-align: center; margin-top: 40px;">© ${new Date().getFullYear()} eShop. Todos los derechos reservados.</p>
    </div>
    `;
};
