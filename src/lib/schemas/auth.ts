import { z } from 'zod';

const emailField = z.string().trim().toLowerCase().email('Email inválido').max(255);

/**
 * Registro de cliente nuevo. La contraseña tiene mínimo 8 (no 6 como tenía
 * antes el handler) — incrementar el coste de fuerza bruta sin afectar
 * usabilidad.
 */
export const registerSchema = z.object({
    name: z.string().trim().min(2, 'Nombre demasiado corto').max(100),
    email: emailField,
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200)
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
    email: emailField
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
    token: z.string().min(10, 'Token inválido').max(500),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200)
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
