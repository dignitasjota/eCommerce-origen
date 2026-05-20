'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';

export interface ExistingImage {
    id: string;
    url: string;
    sort_order: number;
}

interface ImageUploaderProps {
    /**
     * Imágenes ya guardadas en BD. El usuario puede reordenarlas (drag&drop)
     * o marcarlas para borrar. Los cambios se reflejan en estado local hasta
     * que el form padre los envía.
     */
    existingImages?: ExistingImage[];
    /**
     * Permite múltiples imágenes (galería) o sólo una (avatar/logo/cover).
     */
    multiple?: boolean;
    /**
     * Aspect ratio de los previews. Default `1` (cuadrado).
     */
    aspectRatio?: number;
    /**
     * Etiqueta accesible del input.
     */
    label?: string;
    /**
     * `name` para el input file. Por defecto "images". Necesario para que
     * el FormData del form padre los recoja con `formData.getAll(name)`.
     */
    name?: string;
    /**
     * `name` del input hidden con el orden serializado de las imágenes
     * existentes (JSON con array `{id, sort_order, deleted}[]`).
     * El server action lo parsea para aplicar reorder/delete.
     */
    orderFieldName?: string;
    /**
     * Tamaño máximo en MB por archivo. Default 8.
     */
    maxSizeMB?: number;
}

/**
 * Subida de imágenes con drag & drop, preview y reordenación.
 *
 * Comportamiento:
 *   - Drop zone admite drag de archivos del SO o pegar desde portapapeles.
 *   - Cada archivo nuevo se previsualiza con `URL.createObjectURL` (revocado
 *     al desmontar para no leakear memoria).
 *   - Las imágenes existentes son reordenables con HTML5 native drag (sin
 *     dependencia de `react-beautiful-dnd` ni similar).
 *   - El componente NO sube nada por sí mismo. Mete los archivos en el form
 *     padre via input[type=file] oculto (multiple) y serializa el orden /
 *     deletes en un input hidden JSON. La server action ya existente del
 *     padre los procesa.
 */
export default function ImageUploader({
    existingImages = [],
    multiple = true,
    aspectRatio = 1,
    label = 'Imágenes',
    name = 'images',
    orderFieldName = 'images_order',
    maxSizeMB = 8
}: ImageUploaderProps) {
    const [existing, setExisting] = useState<(ExistingImage & { deleted?: boolean })[]>(
        () => [...existingImages].sort((a, b) => a.sort_order - b.sort_order)
    );
    const [newFiles, setNewFiles] = useState<{ file: File; previewUrl: string }[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragSrcIdx = useRef<number | null>(null);

    // Limpieza: revocar object URLs al desmontar para no leakear memoria.
    useEffect(() => {
        return () => {
            newFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
        };
    }, [newFiles]);

    const acceptFiles = useCallback(
        (files: FileList | File[]) => {
            setError(null);
            const arr = Array.from(files);
            const valid: { file: File; previewUrl: string }[] = [];
            const maxBytes = maxSizeMB * 1024 * 1024;

            for (const file of arr) {
                if (!file.type.startsWith('image/')) {
                    setError(`"${file.name}" no es una imagen`);
                    continue;
                }
                if (file.size > maxBytes) {
                    setError(`"${file.name}" excede ${maxSizeMB} MB`);
                    continue;
                }
                valid.push({ file, previewUrl: URL.createObjectURL(file) });
            }

            if (!multiple && valid.length > 0) {
                // Reemplazar por el último seleccionado.
                newFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
                setNewFiles([valid[valid.length - 1]]);
            } else if (valid.length > 0) {
                setNewFiles((prev) => [...prev, ...valid]);
            }

            // Cuando reemplazamos el contenido del input file con setFiles del
            // navegador (no se puede directamente desde JS por seguridad), el
            // form padre necesita que el input mantenga los archivos. Por eso
            // el patrón aquí es: el input file es el "fuente de verdad"
            // accesible y los previews salen de la lectura del input.
            // Siguiente render: sincronizar input file con el array.
        },
        [newFiles, maxSizeMB, multiple]
    );

    // Sync de los archivos seleccionados al input file mediante DataTransfer.
    // Esto es lo que permite que cuando el form se envíe, el input file
    // contenga exactamente lo que el usuario ve en la UI.
    useEffect(() => {
        if (!fileInputRef.current) return;
        const dt = new DataTransfer();
        newFiles.forEach((f) => dt.items.add(f.file));
        fileInputRef.current.files = dt.files;
    }, [newFiles]);

    const removeNewFile = (idx: number) => {
        setNewFiles((prev) => {
            URL.revokeObjectURL(prev[idx].previewUrl);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const toggleDeleteExisting = (id: string) => {
        setExisting((prev) =>
            prev.map((img) => (img.id === id ? { ...img, deleted: !img.deleted } : img))
        );
    };

    const moveExisting = (from: number, to: number) => {
        setExisting((prev) => {
            const copy = [...prev];
            const [removed] = copy.splice(from, 1);
            copy.splice(to, 0, removed);
            return copy.map((img, idx) => ({ ...img, sort_order: idx }));
        });
    };

    // Drop zone handlers.
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    const onDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) {
            acceptFiles(e.dataTransfer.files);
        }
    };

    // Paste desde portapapeles (Ctrl+V dentro del drop zone).
    const onPaste = (e: React.ClipboardEvent) => {
        const files = Array.from(e.clipboardData.files);
        if (files.length > 0) acceptFiles(files);
    };

    // Serializa el estado de las imágenes existentes para que la server action
    // sepa qué reordenar / borrar.
    const orderPayload = JSON.stringify(
        existing.map((img) => ({
            id: img.id,
            sort_order: img.sort_order,
            deleted: !!img.deleted
        }))
    );

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium">{label}</label>

            {/* Drop zone */}
            <div
                role="region"
                aria-label="Zona de subida de imágenes"
                tabIndex={0}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onPaste={onPaste}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                    }
                }}
                style={{
                    border: `2px dashed ${isDragging ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-md, 8px)',
                    padding: '1.5rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: isDragging ? 'var(--color-background-soft)' : 'transparent',
                    transition: 'border-color 0.15s, background 0.15s'
                }}
            >
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                    📂 Arrastra imágenes aquí o <strong>haz click</strong> para seleccionar
                </p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
                    {multiple ? 'Una o varias' : 'Una sola'} · Máx {maxSizeMB} MB · JPG/PNG/WebP
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    name={name}
                    accept="image/*"
                    multiple={multiple}
                    onChange={(e) => e.target.files && acceptFiles(e.target.files)}
                    style={{ display: 'none' }}
                />
            </div>

            {/* Hidden input con el orden / deletes serializado para la server action. */}
            <input type="hidden" name={orderFieldName} value={orderPayload} />

            {error && (
                <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '0.85rem', margin: 0 }}>
                    {error}
                </p>
            )}

            {/* Galería: existentes + nuevas. Existentes son reordenables. */}
            {(existing.length > 0 || newFiles.length > 0) && (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                        gap: '0.75rem'
                    }}
                >
                    {existing.map((img, idx) => (
                        <div
                            key={img.id}
                            draggable={!img.deleted}
                            onDragStart={() => {
                                dragSrcIdx.current = idx;
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                if (dragSrcIdx.current !== null && dragSrcIdx.current !== idx) {
                                    moveExisting(dragSrcIdx.current, idx);
                                }
                                dragSrcIdx.current = null;
                            }}
                            style={{
                                position: 'relative',
                                aspectRatio: String(aspectRatio),
                                borderRadius: 'var(--radius-md, 8px)',
                                overflow: 'hidden',
                                border: '1px solid var(--color-border)',
                                opacity: img.deleted ? 0.3 : 1,
                                cursor: img.deleted ? 'default' : 'grab'
                            }}
                        >
                            <Image src={img.url} alt="" fill sizes="120px" style={{ objectFit: 'cover' }} />
                            <button
                                type="button"
                                onClick={() => toggleDeleteExisting(img.id)}
                                aria-label={img.deleted ? 'Restaurar imagen' : 'Eliminar imagen'}
                                title={img.deleted ? 'Restaurar' : 'Eliminar'}
                                style={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    background: 'rgba(0,0,0,0.6)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: 24,
                                    height: 24,
                                    cursor: 'pointer',
                                    fontSize: 14
                                }}
                            >
                                {img.deleted ? '↺' : '×'}
                            </button>
                            {idx === 0 && !img.deleted && (
                                <span
                                    style={{
                                        position: 'absolute',
                                        bottom: 4,
                                        left: 4,
                                        background: 'var(--color-primary)',
                                        color: 'white',
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 600
                                    }}
                                >
                                    Principal
                                </span>
                            )}
                        </div>
                    ))}

                    {newFiles.map((f, idx) => (
                        <div
                            key={`new-${idx}`}
                            style={{
                                position: 'relative',
                                aspectRatio: String(aspectRatio),
                                borderRadius: 'var(--radius-md, 8px)',
                                overflow: 'hidden',
                                border: '2px solid var(--color-success, #10b981)'
                            }}
                        >
                            <img
                                src={f.previewUrl}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                            <button
                                type="button"
                                onClick={() => removeNewFile(idx)}
                                aria-label="Quitar imagen"
                                style={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    background: 'rgba(0,0,0,0.6)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: 24,
                                    height: 24,
                                    cursor: 'pointer',
                                    fontSize: 14
                                }}
                            >
                                ×
                            </button>
                            <span
                                style={{
                                    position: 'absolute',
                                    bottom: 4,
                                    left: 4,
                                    background: 'var(--color-success, #10b981)',
                                    color: 'white',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 600
                                }}
                            >
                                Nueva
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {existing.length > 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)', margin: 0 }}>
                    💡 Arrastra las imágenes para reordenarlas. La primera será la imagen principal.
                </p>
            )}
        </div>
    );
}
