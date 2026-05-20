/**
 * Parser de shortcodes para el contenido HTML enriquecido de Pages.
 *
 * Sintaxis soportada:
 *   {{category_id:slug-de-categoria}}
 *
 * El sistema antiguo dividía el HTML con un regex y luego inyectaba cada
 * fragmento con `dangerouslySetInnerHTML`, lo que (a) reabría la superficie
 * de XSS en cada fragmento y (b) rompía el HTML cuando un shortcode partía
 * un tag a la mitad (ej. `<p>{{...}}</p>` se parseaba en tres `<div>`s).
 *
 * Este parser produce un AST plano de bloques. El consumidor renderiza:
 *   - `'html'` → un único `<div dangerouslySetInnerHTML>` con el contenido
 *     ya sanitizado (la sanitización ocurre al GUARDAR, en las server actions
 *     de Pages/LegalPages, así que aquí asumimos input ya limpio).
 *   - `'shortcode'` → un componente React tipado (CategoryBlock, etc.).
 *
 * Si en el futuro añadimos más shortcodes, basta con sumar variantes a
 * `ShortcodeNode` y casos al renderer; el parser sigue funcionando.
 */

export interface HtmlNode {
    type: 'html';
    content: string;
}

export interface CategoryShortcodeNode {
    type: 'shortcode';
    name: 'category_id';
    arg: string; // slug de la categoría
}

export type ShortcodeNode = CategoryShortcodeNode;
export type ContentNode = HtmlNode | ShortcodeNode;

const SHORTCODE_RE = /\{\{(category_id):([a-zA-Z0-9-]+)\}\}/g;

export function parseShortcodes(content: string): ContentNode[] {
    const nodes: ContentNode[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;

    SHORTCODE_RE.lastIndex = 0;
    while ((m = SHORTCODE_RE.exec(content)) !== null) {
        if (m.index > lastIndex) {
            nodes.push({ type: 'html', content: content.slice(lastIndex, m.index) });
        }
        const [, name, arg] = m;
        if (name === 'category_id') {
            nodes.push({ type: 'shortcode', name: 'category_id', arg });
        }
        lastIndex = m.index + m[0].length;
    }

    if (lastIndex < content.length) {
        nodes.push({ type: 'html', content: content.slice(lastIndex) });
    }

    return nodes;
}
