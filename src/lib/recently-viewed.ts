import { cookies } from 'next/headers';

const COOKIE_NAME = 'eshop_recent';
const MAX_ITEMS = 12;
const MAX_AGE_DAYS = 30;

/**
 * "Productos vistos recientemente" — almacenado en cookie del usuario para no
 * depender de cuenta. Es un array de slugs (strings cortos) en orden inverso
 * cronológico (el más reciente primero).
 *
 * Limitamos a 12 items y 30 días para no inflar la cookie ni guardar señal
 * obsoleta. Una cookie de 12 slugs ocupa típicamente 200-400 bytes.
 */

export async function getRecentSlugs(): Promise<string[]> {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;
    if (!raw) return [];
    try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((s): s is string => typeof s === 'string' && s.length < 200).slice(0, MAX_ITEMS);
    } catch {
        return [];
    }
}

/**
 * Mueve `slug` al frente de la lista. Llamar desde una Server Action o desde
 * `product/[slug]/page.tsx` (server). No bloquea el render: si por algún
 * motivo el cookieStore es de solo lectura (caso edge), falla en silencio.
 */
export async function pushRecentSlug(slug: string): Promise<void> {
    if (!slug) return;
    try {
        const cookieStore = await cookies();
        const current = await getRecentSlugs();
        const next = [slug, ...current.filter((s) => s !== slug)].slice(0, MAX_ITEMS);
        cookieStore.set(COOKIE_NAME, encodeURIComponent(JSON.stringify(next)), {
            maxAge: MAX_AGE_DAYS * 86_400,
            path: '/',
            sameSite: 'lax',
            httpOnly: false // se podría leer también desde cliente para popup en cart
        });
    } catch {
        /* cookies() puede ser readonly fuera de SC dinámicos */
    }
}
