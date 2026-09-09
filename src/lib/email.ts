import nodemailer from 'nodemailer';
import prisma from '@/lib/db';
import { captureError } from '@/lib/sentry';

interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
}

export interface SendEmailResult {
    success: boolean;
    message?: string;
    error?: string;
}

/**
 * Envía un email transaccional. Contrato: SIEMPRE devuelve `{success, ...}`,
 * nunca lanza — igual que antes. La diferencia es que ahora `success` refleja
 * la realidad: si no hay SMTP configurado (ni en SiteSettings ni en env) o si
 * el envío falla, `success` es `false` con un mensaje legible en `error`.
 *
 * Antes esta función devolvía `{success:true}` aunque no hubiera SMTP
 * configurado ("simulaba" el envío), así que cualquier caller que confiara en
 * el resultado (o cualquier usuario esperando el email) no tenía forma de
 * saber que nunca se envió nada. Los callers que tratan el email como
 * best-effort (fire-and-forget) siguen funcionando igual; los que SÍ
 * comprueban `.success` (p.ej. el formulario de contacto) ahora reciben la
 * respuesta correcta.
 */
export const sendEmail = async (options: SendEmailOptions): Promise<SendEmailResult> => {
    try {
        const settings = await prisma.siteSetting.findMany({
            where: {
                key: { in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from'] }
            }
        });

        const getSetting = (key: string) => settings.find(s => s.key === key)?.value;

        const SMTP_HOST = getSetting('smtp_host') || process.env.SMTP_HOST;
        const SMTP_PORT = getSetting('smtp_port') || process.env.SMTP_PORT;
        const SMTP_USER = getSetting('smtp_user') || process.env.SMTP_USER;
        const SMTP_PASS = getSetting('smtp_pass') || process.env.SMTP_PASS;
        const EMAIL_FROM = getSetting('smtp_from') || process.env.EMAIL_FROM;

        if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
            const error = 'SMTP no configurado (faltan claves en SiteSettings/env) — email NO enviado';
            console.error(`[email] ${error}. Destinatario: ${options.to}, asunto: "${options.subject}"`);
            captureError(new Error(error), {
                tags: { area: 'email', reason: 'smtp_not_configured' },
                extra: { subject: options.subject }
            });
            return { success: false, error };
        }

        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: parseInt(SMTP_PORT, 10),
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });

        const mailOptions = {
            from: EMAIL_FROM,
            to: options.to,
            subject: options.subject,
            html: options.html,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);

        return { success: true, message: 'Email sent successfully' };
    } catch (error) {
        console.error('Error sending email:', error);
        captureError(error, {
            tags: { area: 'email', reason: 'smtp_send_failed' },
            extra: { subject: options.subject }
        });
        return { success: false, error: error instanceof Error ? error.message : 'Error desconocido enviando email' };
    }
};
