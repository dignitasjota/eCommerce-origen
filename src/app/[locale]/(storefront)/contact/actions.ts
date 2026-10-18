'use server';

import { headers } from 'next/headers';
import { sendEmail } from '@/lib/email';
import prisma from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { escapeHtml } from '@/lib/sanitize';

const MAX_FIELD = { name: 100, email: 255, subject: 200, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitContactForm(formData: FormData) {
    try {
        // Endpoint anónimo que dispara un email: sin límite, cualquiera podía
        // usarlo para inundar el buzón de la tienda.
        const limit = rateLimit({ headers: await headers() }, { bucket: 'contact', max: 3, windowMs: 10 * 60_000 });
        if (!limit.ok) {
            return { success: false, error: 'Has enviado demasiados mensajes. Inténtalo más tarde.' };
        }

        const field = (k: keyof typeof MAX_FIELD) => ((formData.get(k) as string) || '').trim();
        const name = field('name');
        const email = field('email');
        const subject = field('subject');
        const message = field('message');

        if (!name || !email || !subject || !message) {
            return { success: false, error: 'Todos los campos son obligatorios.' };
        }
        if (!EMAIL_RE.test(email)) {
            return { success: false, error: 'Email no válido.' };
        }
        if ((Object.keys(MAX_FIELD) as (keyof typeof MAX_FIELD)[]).some((k) => field(k).length > MAX_FIELD[k])) {
            return { success: false, error: 'Algún campo es demasiado largo.' };
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
                    <p><strong>De:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
                    <p><strong>Asunto:</strong> ${escapeHtml(subject)}</p>
                    <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                    <p style="white-space: pre-wrap; font-size: 16px;">${escapeHtml(message)}</p>
                </div>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">
                    Este email fue generado automáticamente por tu tienda eShop.
                </p>
            </div>
        `;

        const result = await sendEmail({
            to: receiverEmail,
            subject: `[Contacto Tienda] ${subject.replace(/[\r\n]+/g, ' ')}`,
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
