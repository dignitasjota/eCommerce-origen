/**
 * Helpers para paginación basada en cursor (keyset pagination).
 *
 * El cursor codifica el par (created_at, id) — NO sólo `id`. Los UUID de este
 * proyecto se generan con `@default(uuid())` de Prisma, que es UUID v4
 * ALEATORIO (no ordenable): paginar sólo por `id DESC` no respeta el orden
 * cronológico que el usuario espera ("página siguiente = más antiguo"), y de
 * hecho el orden "cambia" cada vez que se crea una fila nueva en medio del
 * rango ya visto. `created_at` tampoco es único por sí solo (dos filas
 * pueden compartir el mismo milisegundo), así que usamos (created_at, id)
 * como keyset compuesto: ordenamos por ambos campos y filtramos con el
 * equivalente a "fila estrictamente posterior al cursor" en ese orden.
 *
 * Comparado con offset/limit:
 *   - Offset: SELECT … LIMIT 25 OFFSET (page-1)*25 — cuando page crece, la BD
 *     debe escanear (page-1)*25 filas antes de devolver. A 100k filas y page=400
 *     son 10M filas escaneadas inútilmente.
 *   - Cursor: SELECT … WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC
 *     LIMIT 25 — siempre escanea 25 filas (con índice en created_at). Lineal
 *     en N páginas, no cuadrático.
 *
 * Tradeoffs aceptados:
 *   - No hay "ir a la página 7" — sólo siguiente/anterior. Aceptable en
 *     listados descendentes (audits, orders, blog) donde el usuario navega
 *     cronológicamente.
 *   - El cursor es opaco para el cliente (base64url de JSON) → si cambias el
 *     formato interno, los enlaces antiguos dejan de funcionar (recargar = OK).
 *
 * Uso típico (Prisma):
 *
 *   const { take, cursor } = parseCursorParams(searchParams);
 *   const cursorWhere = buildCursorWhere(cursor);
 *   const rows = await prisma.entity.findMany({
 *     where: cursorWhere ? { AND: [whereBase, cursorWhere] } : whereBase,
 *     orderBy: CURSOR_ORDER_BY,
 *     take: take + 1     // pedimos 1 extra para detectar hasNext
 *   });
 *   const { items, nextCursor } = buildCursorPage(rows, take);
 */

const DEFAULT_PER_PAGE = 25;
const MAX_PER_PAGE = 100;

export interface CursorPayload {
    id: string;
    /** ISO 8601. Componente principal del keyset. */
    createdAt: string;
}

/** Codifica un cursor opaco (base64url). El cliente nunca lo interpreta. */
export function encodeCursor(id: string, createdAt: Date | string): string {
    const iso = createdAt instanceof Date ? createdAt.toISOString() : createdAt;
    return Buffer.from(JSON.stringify({ id, createdAt: iso }), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined | null): CursorPayload | null {
    if (!raw || typeof raw !== 'string') return null;
    try {
        const json = Buffer.from(raw, 'base64url').toString('utf8');
        const parsed = JSON.parse(json) as Partial<CursorPayload>;
        if (typeof parsed.id !== 'string' || parsed.id.length === 0) return null;
        if (typeof parsed.createdAt !== 'string' || Number.isNaN(new Date(parsed.createdAt).getTime())) {
            return null;
        }
        return { id: parsed.id, createdAt: parsed.createdAt };
    } catch {
        return null;
    }
}

export interface ParsedCursorParams {
    take: number;
    cursor: CursorPayload | null;
}

export function parseCursorParams(searchParams: {
    [key: string]: string | string[] | undefined;
}): ParsedCursorParams {
    const cursorRaw = typeof searchParams.cursor === 'string' ? searchParams.cursor : undefined;
    const cursor = decodeCursor(cursorRaw);

    let take = DEFAULT_PER_PAGE;
    const perPageRaw = searchParams.perPage;
    if (typeof perPageRaw === 'string') {
        const n = parseInt(perPageRaw, 10);
        if (Number.isInteger(n) && n > 0 && n <= MAX_PER_PAGE) {
            take = n;
        }
    }

    return { take, cursor };
}

/**
 * Orden que TODO caller de paginación cursor debe usar. `id` desempata
 * cuando dos filas comparten `created_at` (mismo milisegundo) — sin el
 * desempate, `buildCursorWhere` podría saltarse u repetir filas empatadas.
 */
export const CURSOR_ORDER_BY = [{ created_at: 'desc' as const }, { id: 'desc' as const }];

/**
 * Filtro `where` (keyset) equivalente a "fila estrictamente posterior al
 * cursor" en el orden `CURSOR_ORDER_BY`. `undefined` en la primera página —
 * el caller debe mezclarlo con su `where` base dentro de un `AND` (no
 * asignarlo directamente, para no pisar un `OR` que el caller ya use para
 * sus propios filtros de búsqueda).
 */
export function buildCursorWhere(cursor: CursorPayload | null) {
    if (!cursor) return undefined;
    const createdAt = new Date(cursor.createdAt);
    return {
        OR: [{ created_at: { lt: createdAt } }, { created_at: createdAt, id: { lt: cursor.id } }]
    };
}

/**
 * Resultado canónico de una query paginada — el handler/componente llama
 * a `buildCursorPage` con las filas de Prisma y obtiene items + cursor de la
 * próxima página.
 */
export interface CursorPage<T> {
    items: T[];
    nextCursor: string | null;
}

export function buildCursorPage<T extends { id: string; created_at: Date }>(
    rows: T[],
    take: number
): CursorPage<T> {
    const hasNext = rows.length > take;
    const items = hasNext ? rows.slice(0, take) : rows;
    const last = items[items.length - 1];
    const nextCursor = hasNext && last ? encodeCursor(last.id, last.created_at) : null;
    return { items, nextCursor };
}
