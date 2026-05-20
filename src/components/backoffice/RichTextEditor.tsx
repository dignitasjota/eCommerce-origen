'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { useEffect } from 'react';

interface RichTextEditorProps {
    /**
     * Contenido HTML inicial. Puede contener shortcodes `{{category_id:slug}}`
     * (Tiptap los preserva como texto plano dentro del HTML).
     */
    value: string;
    /**
     * Llamado en cada cambio con el HTML serializado. El padre es responsable
     * de pasar este HTML por `sanitizeHtml` antes de guardarlo.
     */
    onChange: (html: string) => void;
    /**
     * Texto placeholder cuando el editor está vacío.
     */
    placeholder?: string;
    /**
     * Altura mínima del área editable en CSS units (default `200px`).
     */
    minHeight?: string;
}

/**
 * Editor WYSIWYG rico basado en Tiptap.
 *
 * Decisiones:
 *  - Output HTML, no JSON: ya tenemos `sanitizeHtml` server-side y los
 *    shortcodes `{{category_id:slug}}` se procesan sobre HTML en
 *    `DynamicPageView`. Cambiar a JSON requeriría reescribir esa pipeline.
 *  - StarterKit aporta lo básico (headings, listas, bold, italic, blockquote,
 *    code, hr). Añadimos Link, Image, Placeholder y TextAlign.
 *  - El componente sólo monta tras hidratar (`mounted`) para evitar mismatch
 *    SSR ↔ CSR (Tiptap genera markup distinto en cliente).
 */
export default function RichTextEditor({
    value,
    onChange,
    placeholder = 'Escribe aquí...',
    minHeight = '200px'
}: RichTextEditorProps) {
    const editor = useEditor({
        immediatelyRender: false, // evita SSR mismatch con Next 16
        extensions: [
            StarterKit.configure({
                // Heading: nos quedamos con 2 y 3 (h1 lo manda el layout de la página)
                heading: { levels: [2, 3] }
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    rel: 'noopener noreferrer',
                    target: '_blank'
                }
            }),
            Image.configure({
                inline: false,
                allowBase64: false
            }),
            Placeholder.configure({ placeholder }),
            TextAlign.configure({ types: ['heading', 'paragraph'] })
        ],
        content: value,
        editorProps: {
            attributes: {
                class: 'rte-content',
                role: 'textbox',
                'aria-multiline': 'true'
            }
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        }
    });

    // Sincronizar contenido externo si el padre lo cambia (p. ej. al abrir el
    // modal con un post distinto). Sólo aplica si difiere para no perder
    // selección durante typing.
    useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        if (value !== current) {
            editor.commands.setContent(value || '', false);
        }
    }, [value, editor]);

    // Con `immediatelyRender: false`, useEditor devuelve null durante SSR y
    // sólo se materializa tras hidratar — esto cubre el caso de fallback.
    if (!editor) {
        return (
            <div
                className="admin-form-input"
                style={{ minHeight, padding: '0.75rem', color: 'var(--color-text-tertiary)' }}
            >
                Cargando editor…
            </div>
        );
    }

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href as string | undefined;
        const url = window.prompt('URL del enlace', previousUrl ?? 'https://');
        if (url === null) return; // cancel
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    };

    const insertImage = () => {
        const url = window.prompt('URL de la imagen');
        if (!url) return;
        editor.chain().focus().setImage({ src: url }).run();
    };

    return (
        <div className="rte-wrapper">
            <div className="rte-toolbar" role="toolbar" aria-label="Formato de texto">
                <BtnGroup>
                    <Btn
                        active={editor.isActive('heading', { level: 2 })}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                        title="Encabezado H2"
                    >
                        H2
                    </Btn>
                    <Btn
                        active={editor.isActive('heading', { level: 3 })}
                        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                        title="Encabezado H3"
                    >
                        H3
                    </Btn>
                    <Btn
                        active={editor.isActive('paragraph')}
                        onClick={() => editor.chain().focus().setParagraph().run()}
                        title="Párrafo"
                    >
                        ¶
                    </Btn>
                </BtnGroup>

                <BtnGroup>
                    <Btn
                        active={editor.isActive('bold')}
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        title="Negrita (Ctrl+B)"
                    >
                        <strong>B</strong>
                    </Btn>
                    <Btn
                        active={editor.isActive('italic')}
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        title="Cursiva (Ctrl+I)"
                    >
                        <em>I</em>
                    </Btn>
                    <Btn
                        active={editor.isActive('strike')}
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        title="Tachado"
                    >
                        <s>S</s>
                    </Btn>
                    <Btn
                        active={editor.isActive('code')}
                        onClick={() => editor.chain().focus().toggleCode().run()}
                        title="Código en línea"
                    >
                        {'<>'}
                    </Btn>
                </BtnGroup>

                <BtnGroup>
                    <Btn
                        active={editor.isActive('bulletList')}
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        title="Lista con viñetas"
                    >
                        •
                    </Btn>
                    <Btn
                        active={editor.isActive('orderedList')}
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        title="Lista numerada"
                    >
                        1.
                    </Btn>
                    <Btn
                        active={editor.isActive('blockquote')}
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        title="Cita"
                    >
                        ❝
                    </Btn>
                </BtnGroup>

                <BtnGroup>
                    <Btn
                        active={editor.isActive({ textAlign: 'left' })}
                        onClick={() => editor.chain().focus().setTextAlign('left').run()}
                        title="Alinear izquierda"
                    >
                        ⇤
                    </Btn>
                    <Btn
                        active={editor.isActive({ textAlign: 'center' })}
                        onClick={() => editor.chain().focus().setTextAlign('center').run()}
                        title="Centrar"
                    >
                        ⇔
                    </Btn>
                    <Btn
                        active={editor.isActive({ textAlign: 'right' })}
                        onClick={() => editor.chain().focus().setTextAlign('right').run()}
                        title="Alinear derecha"
                    >
                        ⇥
                    </Btn>
                </BtnGroup>

                <BtnGroup>
                    <Btn active={editor.isActive('link')} onClick={setLink} title="Insertar enlace">
                        🔗
                    </Btn>
                    <Btn onClick={insertImage} title="Insertar imagen por URL">
                        🖼
                    </Btn>
                    <Btn
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        title="Línea horizontal"
                    >
                        ─
                    </Btn>
                </BtnGroup>

                <BtnGroup>
                    <Btn
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        title="Deshacer (Ctrl+Z)"
                    >
                        ↶
                    </Btn>
                    <Btn
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        title="Rehacer (Ctrl+Y)"
                    >
                        ↷
                    </Btn>
                </BtnGroup>
            </div>

            <EditorContent editor={editor} style={{ minHeight }} />

            <style jsx>{`
                .rte-wrapper {
                    border: 1px solid var(--color-border);
                    border-radius: var(--radius-md, 8px);
                    background: var(--color-background);
                    overflow: hidden;
                }
                .rte-toolbar {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.25rem;
                    padding: 0.5rem;
                    border-bottom: 1px solid var(--color-border);
                    background: var(--color-background-soft, var(--color-background));
                }
                :global(.rte-content) {
                    padding: 0.75rem 1rem;
                    outline: none;
                    line-height: 1.55;
                    color: var(--color-text-primary);
                }
                :global(.rte-content p.is-editor-empty:first-child::before) {
                    content: attr(data-placeholder);
                    float: left;
                    color: var(--color-text-tertiary);
                    pointer-events: none;
                    height: 0;
                }
                :global(.rte-content h2) {
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin: 1rem 0 0.5rem;
                }
                :global(.rte-content h3) {
                    font-size: 1.25rem;
                    font-weight: 600;
                    margin: 0.75rem 0 0.4rem;
                }
                :global(.rte-content ul) {
                    list-style: disc;
                    padding-left: 1.5rem;
                }
                :global(.rte-content ol) {
                    list-style: decimal;
                    padding-left: 1.5rem;
                }
                :global(.rte-content blockquote) {
                    border-left: 3px solid var(--color-primary);
                    padding-left: 0.75rem;
                    margin: 0.75rem 0;
                    color: var(--color-text-secondary);
                    font-style: italic;
                }
                :global(.rte-content code) {
                    background: var(--color-background-soft);
                    padding: 0.1em 0.35em;
                    border-radius: 4px;
                    font-family: ui-monospace, monospace;
                    font-size: 0.9em;
                }
                :global(.rte-content a) {
                    color: var(--color-primary);
                    text-decoration: underline;
                }
                :global(.rte-content img) {
                    max-width: 100%;
                    height: auto;
                    border-radius: 4px;
                }
                :global(.rte-content hr) {
                    border: none;
                    border-top: 1px solid var(--color-border);
                    margin: 1rem 0;
                }
            `}</style>
        </div>
    );
}

function BtnGroup({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                display: 'inline-flex',
                gap: 2,
                paddingRight: 6,
                marginRight: 6,
                borderRight: '1px solid var(--color-border)'
            }}
        >
            {children}
        </div>
    );
}

function Btn({
    onClick,
    active,
    disabled,
    title,
    children
}: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title?: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-pressed={active}
            style={{
                minWidth: 32,
                height: 30,
                padding: '0 0.4rem',
                border: '1px solid transparent',
                borderRadius: 4,
                background: active ? 'var(--color-primary)' : 'transparent',
                color: active ? 'white' : 'var(--color-text-primary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.4 : 1,
                fontSize: 14,
                lineHeight: 1
            }}
        >
            {children}
        </button>
    );
}
