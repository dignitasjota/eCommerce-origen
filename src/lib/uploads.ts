import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import crypto from 'crypto';

export class InvalidImageUploadError extends Error {}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

// Sniffing de magic bytes: el `file.type` declarado por el cliente no es de
// fiar (es un valor MIME arbitrario elegido por quien hace la petición), así
// que comprobamos la cabecera real del contenido antes de confiar en él.
const MAGIC_BYTE_CHECKS: Array<{ ext: string; matches: (buf: Buffer) => boolean }> = [
    {
        ext: 'jpg',
        matches: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    },
    {
        ext: 'png',
        matches: (b) =>
            b.length > 8 &&
            b[0] === 0x89 &&
            b[1] === 0x50 &&
            b[2] === 0x4e &&
            b[3] === 0x47 &&
            b[4] === 0x0d &&
            b[5] === 0x0a &&
            b[6] === 0x1a &&
            b[7] === 0x0a,
    },
    { ext: 'gif', matches: (b) => b.length > 5 && b.toString('ascii', 0, 3) === 'GIF' },
    {
        ext: 'webp',
        matches: (b) =>
            b.length > 11 &&
            b.toString('ascii', 0, 4) === 'RIFF' &&
            b.toString('ascii', 8, 12) === 'WEBP',
    },
];

interface SaveImageOptions {
    /** Subcarpeta bajo public/uploads/ (p.ej. 'categories', 'blog'). Opcional. */
    subdir?: string;
    /** Prefijo legible del nombre de archivo generado (p.ej. 'product_<id>'). */
    prefix: string;
    maxBytes?: number;
}

/**
 * Guarda una imagen subida por un admin validando tipo declarado + magic
 * bytes reales, con límite de tamaño server-side. El nombre de archivo final
 * se genera ÍNTEGRAMENTE en el servidor (prefijo controlado + UUID) — el
 * nombre original del cliente (`file.name`) nunca se usa, ni para el
 * filename ni para derivar la extensión, para evitar tanto la inyección de
 * segmentos de ruta como la subida de tipos arbitrarios (p.ej. .html/.svg
 * servidos luego como contenido estático desde /uploads/, lo que abriría
 * XSS almacenado en el propio origen).
 */
export async function saveUploadedImage(
    file: File,
    { subdir, prefix, maxBytes = MAX_IMAGE_BYTES }: SaveImageOptions
): Promise<string> {
    if (file.size > maxBytes) {
        throw new InvalidImageUploadError(
            `El archivo supera el tamaño máximo permitido (${Math.round(maxBytes / (1024 * 1024))}MB)`
        );
    }

    const declaredExt = ALLOWED_IMAGE_TYPES[file.type];
    if (!declaredExt) {
        throw new InvalidImageUploadError('Tipo de imagen no permitido');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = MAGIC_BYTE_CHECKS.find((check) => check.matches(buffer));
    if (!sniffed || sniffed.ext !== declaredExt) {
        throw new InvalidImageUploadError('El contenido del archivo no coincide con el tipo declarado');
    }

    const dir = join(process.cwd(), 'public', 'uploads', ...(subdir ? [subdir] : []));
    await mkdir(dir, { recursive: true });

    const safePrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${safePrefix}_${Date.now()}_${crypto.randomUUID()}.${declaredExt}`;
    await writeFile(join(dir, filename), buffer);

    return subdir ? `/uploads/${subdir}/${filename}` : `/uploads/${filename}`;
}
