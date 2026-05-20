import { z } from 'zod';

const addressSchema = z.object({
    firstName: z.string().trim().min(1, 'Nombre requerido').max(100),
    lastName: z.string().trim().min(1, 'Apellidos requeridos').max(100),
    address1: z.string().trim().min(1, 'Dirección requerida').max(255),
    address2: z.string().trim().max(255).optional().nullable(),
    city: z.string().trim().min(1, 'Ciudad requerida').max(100),
    state: z.string().trim().max(100).optional().nullable(),
    postalCode: z.string().trim().min(1, 'Código postal requerido').max(20),
    country: z.string().trim().min(1, 'País requerido').max(100),
    phone: z.string().trim().max(50).optional().nullable()
});

const itemSchema = z.object({
    product_id: z.string().min(1).max(36),
    variant_id: z.string().min(1).max(36).optional().nullable(),
    quantity: z.number().int().min(1).max(999),
    /** Cosméticos — el servidor relee precio/nombre desde DB. */
    name: z.string().max(255).optional(),
    price: z.number().optional(),
    image: z.string().optional(),
    attributes: z.record(z.string(), z.string()).optional()
});

/**
 * Validación del POST /api/storefront/checkout. Email opcional (el handler
 * lo exige sólo cuando no hay sesión). El servidor sigue siendo la fuente
 * de verdad de precios; este schema sólo valida formato.
 */
export const checkoutSchema = z.object({
    email: z.string().trim().toLowerCase().email().max(255).optional(),
    address: addressSchema,
    shippingMethodId: z.string().min(1).max(36),
    paymentMethod: z.enum(['STRIPE', 'CARD', 'COD', 'TRANSFER']),
    items: z.array(itemSchema).min(1, 'Carrito vacío').max(100, 'Demasiados items'),
    locale: z.enum(['es', 'en']).optional(),
    couponCode: z.string().trim().max(50).optional().nullable()
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const couponDryRunSchema = z.object({
    code: z.string().trim().min(1).max(50),
    subtotal: z.number().min(0).max(1_000_000)
});
export type CouponDryRunInput = z.infer<typeof couponDryRunSchema>;
