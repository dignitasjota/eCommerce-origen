'use server';

import { sendEmail } from '@/lib/email';
import prisma from '@/lib/db';

export async function submitContactForm(formData: FormData) {
    try {
        const name = formData.get('name') as string;
        const email = formData.get('email') as string;
        const subject = formData.get('subject') as string;
        const message = formData.get('message') as string;

        if (!name || !email || !subject || !message) {
            return { success: false, error: 'Todos los campos son obligatorios.' };
        }

        // Obtener el email de recepción configurado en el panel
        const receiverSetting = await prisma.siteSetting.findUnique({
            where: { key: 'contact_email_receiver' }
        });

        const receiverEmail = receiverSetting?.value || process.env.CONTACT_EMAIL_RECEIVER || 'contacto@eshop.com';

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h2 style="color: #4F46E5;">Nuevo Mensaje de Contacto</h2>
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
                    <p><strong>De:</strong> ${name} &lt;${email}&gt;</p>
                    <p><strong>Asunto:</strong> ${subject}</p>
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                    <p style="white-space: pre-wrap; font-size: 16px;">${message}</p>
                </div>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
                    Este email fue generado automáticamente por tu tienda eShop.
                </p>
            </div>
        `;

        const result = await sendEmail({
            to: receiverEmail,
            subject: `[Contacto Tienda] ${subject}`,
            html: htmlContent
        });

        if (!result.success) {
            console.error('Error in sendEmail:', result.error);
            return { success: false, error: 'No se pudo enviar el mensaje por un fallo en el servidor de correo.' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error submitting contact form:', error);
        return { success: false, error: 'Ha ocurrido un error inesperado al procesar tu solicitud.' };
    }
}
