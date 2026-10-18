/**
 * Coste de bcrypt único para todo el proyecto (registro, reset de contraseña,
 * alta/edición de usuarios desde el admin). Antes convivían 12 y 10 según el
 * punto de entrada.
 */
export const BCRYPT_COST = 12;
