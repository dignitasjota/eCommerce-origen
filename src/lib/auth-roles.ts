/**
 * Roles con acceso al backoffice. Vive en un módulo aparte (sin dependencias
 * de Prisma/NextAuth) para que pueda importarse desde middleware.ts sin
 * arrastrar el adapter de Prisma al bundle del middleware.
 */
export const ADMIN_ROLES = ['ADMIN', 'ORDER_MANAGER'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
