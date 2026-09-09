import crypto from 'crypto';

/**
 * Tokens de reset de contraseña: JWT-like casero (`payload.signature` en
 * base64url), firmado con HMAC-SHA256. Compartido entre forgot-password
 * (firma) y reset-password (verifica) — antes cada endpoint reimplementaba
 * su propia resolución de secreto con un fallback hardcodeado
 * (`'fallback_development_secret_only'`) si faltaba `NEXTAUTH_SECRET`. En un
 * despliegue mal configurado (env var ausente en producción), eso dejaba los
 * tokens de reset firmados con un secreto público y conocido — visible en el
 * propio código fuente — permitiendo forjar un token de reset de cualquier
 * cuenta.
 */
function getSecret(): string {
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!secret) {
        throw new Error('NEXTAUTH_SECRET no configurado — no se pueden emitir/verificar tokens de reset');
    }
    return secret;
}

export interface ResetTokenPayload {
    id: string;
    email: string;
    hashPrefix: string;
    exp: number;
}

export function signResetToken(payload: ResetTokenPayload): string {
    const secret = getSecret();
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
    return `${payloadStr}.${signature}`;
}

/**
 * Devuelve el payload si el token es válido y no expiró, o `null` en
 * cualquier otro caso (firma inválida, formato corrupto, expirado, o
 * `NEXTAUTH_SECRET` sin configurar — fail-safe: sin secreto, ningún token es
 * válido).
 */
export function verifyResetToken(token: string): ResetTokenPayload | null {
    let secret: string;
    try {
        secret = getSecret();
    } catch {
        return null;
    }

    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) return null;

    const expectedSignature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

    // Comparación timing-safe real: `!==` sobre strings compara byte a byte y
    // aborta en el primer carácter distinto, filtrando por temporización
    // cuánto de la firma acertó el atacante. `timingSafeEqual` exige buffers
    // de igual longitud, así que comprobamos eso primero.
    const signatureBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);
    if (signatureBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(signatureBuf, expectedBuf)) return null;

    try {
        const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8')) as Partial<ResetTokenPayload>;
        if (payload.exp && Date.now() > payload.exp) return null;
        if (!payload.id || !payload.email) return null;
        return payload as ResetTokenPayload;
    } catch {
        return null;
    }
}
