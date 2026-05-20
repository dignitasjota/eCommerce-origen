import DOMPurify, { type Config } from 'isomorphic-dompurify';

/**
 * Tags y atributos permitidos en contenido HTML enriquecido (descripciones de
 * producto, posts de blog, páginas dinámicas, páginas legales). El listado es
 * deliberadamente amplio para que un editor WYSIWYG pueda producir el contenido
 * habitual, pero excluye `script`, `style`, `iframe`, `object`, etc., y los
 * atributos `on*` y `javascript:` URIs.
 *
 * Importante: `{{shortcode}}` se conserva tal cual porque DOMPurify no toca
 * texto plano fuera de etiquetas — el parser de shortcodes sigue funcionando.
 */
const ALLOWED_TAGS = [
    'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup',
    'div', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'i', 'img', 'li', 'mark', 'ol', 'p', 'pre', 'q', 's', 'small',
    'span', 'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th',
    'thead', 'tr', 'u', 'ul'
];

const ALLOWED_ATTR = [
    'href', 'title', 'alt', 'src', 'width', 'height', 'class', 'id', 'rel',
    'target', 'colspan', 'rowspan', 'start', 'type', 'name'
];

const PURIFY_CONFIG: Config = {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Bloquear esquemas peligrosos en href/src.
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'style'],
    KEEP_CONTENT: true,
    USE_PROFILES: { html: true }
};

/**
 * Sanitiza HTML enriquecido (descripciones, post bodies, páginas).
 * Usar SIEMPRE antes de persistir en DB, no únicamente al renderizar.
 */
export function sanitizeHtml(html: string | null | undefined): string {
    if (!html) return '';
    return DOMPurify.sanitize(html, PURIFY_CONFIG) as unknown as string;
}

/**
 * Sanitiza texto que se quiere tratar como plano (sin tags). Útil para
 * meta descriptions, alt text, etc.
 */
export function sanitizeText(value: string | null | undefined): string {
    if (!value) return '';
    return DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }) as unknown as string;
}
