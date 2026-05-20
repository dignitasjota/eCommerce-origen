/**
 * Punto único de exportación para los schemas Zod del proyecto.
 *
 * Convenciones:
 *   - Cada entidad tiene su propio módulo (`checkout.ts`, `auth.ts`, ...).
 *   - Los nombres siguen el patrón `<accion><Entidad>Schema`
 *     (ej. `checkoutSchema`, `registerSchema`).
 *   - Cada schema exporta también el tipo inferido como `<Nombre>Input`.
 *   - Los handlers (API routes / server actions) reciben el body crudo
 *     (`unknown`) y llaman a `safeParse`. Si falla, devolver 400 con el
 *     primer issue como mensaje legible.
 *
 * Helper estándar de error:
 *
 *   const parsed = checkoutSchema.safeParse(body);
 *   if (!parsed.success) {
 *       return NextResponse.json(
 *           { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
 *           { status: 400 }
 *       );
 *   }
 *   const data = parsed.data; // tipado fuerte
 */

export * from './auth';
export * from './checkout';
export * from './newsletter';
