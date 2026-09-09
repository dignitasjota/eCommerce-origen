import { z } from 'zod';

/**
 * `POST /api/storefront/reviews`. `productId` sólo se valida como string no
 * vacío aquí — la pertenencia/compra real se comprueba en el handler contra
 * DB, no es responsabilidad de este schema.
 */
export const createReviewSchema = z.object({
    productId: z.string().min(1).max(36),
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(150).optional().nullable(),
    comment: z.string().trim().max(2000).optional().nullable()
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
