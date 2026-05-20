import { z } from 'zod';

export const newsletterSubscribeSchema = z.object({
    email: z.string().trim().toLowerCase().email('Email no válido').max(255),
    locale: z.enum(['es', 'en']).optional()
});
export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;
