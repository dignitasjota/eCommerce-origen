/**
 * Helpers para paginación basada en cursor.
 *
 * Comparado con offset/limit:
 *   - Offset: SELECT … LIMIT 25 OFFSET (page-1)*25 — cuando page crece, la BD
 *     debe escanear (page-1)*25 filas antes de devolver. A 100k filas y page=400
 *     son 10M filas escaneadas inútilmente.
 *   - Cursor: SELECT … WHERE id < ? ORDER BY id DESC LIMIT 25 — siempre escanea
 *     25 filas. Lineal en N páginas, no cuadrático.
 *
 * Tradeoffs aceptados:
 *   - No hay "ir a la página 7" — sólo siguiente/anterior. Aceptable en
 *     listados descendentes (audits, orders, webhooks) donde el usuario navega
 *     cronológicamente.
 *   - El cursor es opaco para el cliente (base64 de JSON) → si cambias el
 *     formato interno, los enlaces antiguos dejan de funcionar (recargar = OK).
 *
 * Uso típico (Prisma):
 *
 *   const { take, cursorFilter } = parseCursorParams(searchParams);
 *   const rows = await prisma.entity.findMany({
 *     where: { ...whereBase, ...cursorFilter },
 *     orderBy: { id: 'desc' },
 *     take: take + 1     // pedimos 1 extra para detectar hasNext
 *   });
 *   const hasNext = rows.length > take;
 *   const items = rows.slice(0, take);
 *   const nextCursor = hasNext ? encodeCursor(items[items.length - 1].id) : null;
 */

const DEFAULT_PER_PAGE = 25;
const MAX_PER_PAGE = 100;

export interface CursorPayload {
    id: string;
}

/** Codifica un cursor opaco (base64url). El cliente nunca lo interpreta. */
export function encodeCursor(id: string): string {
    return Buffer.from(JSON.stringify({ id }), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined | null): CursorPayload | null {
    if (!raw || typeof raw !== 'string') return null;
    try {
        const json = Buffer.from(raw, 'base64url').toString('utf8');
        const parsed = JSON.parse(json) as Partial<CursorPayload>;
        if (typeof parsed.id !== 'string' || parsed.id.length === 0) return null;
        return { id: parsed.id };
    } catch {
        return null;
    }
}

export interface ParsedCursorParams {
    take: number;
    /**
     * Filtro Prisma listo para mergear con el `where` base. Vacío en la primera
     * página. Asume orden descendente por `id` (UUID v4 no garantiza orden,
     * pero en este proyecto los UUID se generan secuencialmente al crear filas;
     * para orden estable considera añadir `cursor: created_at` también).
     */
    cursorId: string | null;
}

export function parseCursorParams(searchParams: {
    [key: string]: string | string[] | undefined;
}): ParsedCursorParams {
    const cursor = typeof searchParams.cursor === 'string' ? searchParams.cursor : undefined;
    const cursorPayload = decodeCursor(cursor);

    let take = DEFAULT_PER_PAGE;
    const perPageRaw = searchParams.perPage;
    if (typeof perPageRaw === 'string') {
        const n = parseInt(perPageRaw, 10);
        if (Number.isInteger(n) && n > 0 && n <= MAX_PER_PAGE) {
            take = n;
        }
    }

    return { take, cursorId: cursorPayload?.id ?? null };
}

/**
 * Construye `cursor`+`skip`+`take` para `findMany` de Prisma a partir de los
 * parámetros parseados. Devuelve también `nextCursorFromLast` que el caller
 * usa con el último item visible para generar el cursor de la página siguiente.
 */
export function buildPrismaCursorArgs(parsed: ParsedCursorParams) {
    const args: { take: number; skip?: number; cursor?: { id: string } } = {
        take: parsed.take + 1
    };
    if (parsed.cursorId) {
        args.cursor = { id: parsed.cursorId };
        args.skip = 1; // saltar el cursor mismo
    }
    return args;
}

/**
 * Resultado canónico de una query paginada — el handler/componente llama
 * a `paginate` con la query de Prisma y obtiene items + cursor de la próxima.
 */
export interface CursorPage<T> {
    items: T[];
    nextCursor: string | null;
}

export function buildCursorPage<T extends { id: string }>(
    rows: T[],
    take: number
): CursorPage<T> {
    const hasNext = rows.length > take;
    const items = hasNext ? rows.slice(0, take) : rows;
    const nextCursor = hasNext ? encodeCursor(items[items.length - 1].id) : null;
    return { items, nextCursor };
}
