import nodemailer from 'nodemailer';
import prisma from '@/lib/db';

interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
}

export const sendEmail = async (options: SendEmailOptions) => {
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
            console.warn('⚠️ SMTP variables not fully defined in DB or .env. Skipping real email dispatch.');
            // In a real environment, you might want to throw an error here.
            // For development phase we resolve successfully to not break the flow.
            console.log('Simulated Email Dispatch:', options);
            return { success: true, message: 'Simulated email sent' };
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
        return { success: false, error };
    }
};
