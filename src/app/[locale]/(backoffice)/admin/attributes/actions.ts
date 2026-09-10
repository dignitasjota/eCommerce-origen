'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireAdmin, AuthorizationError } from '@/lib/auth';
import { auditLog } from '@/lib/audit';

const DIACRITICS_RE = new RegExp('[̀-ͯ]', 'g');

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(DIACRITICS_RE, '') // quitar acentos (marcas diacríticas tras NFD)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export async function createVariantType(formData: FormData) {
    try {
        await requireAdmin(undefined, 'products.manage');
        const name = (formData.get('name') as string || '').trim();
        if (!name) return { success: false, error: 'El nombre es obligatorio.' };
        const slug = slugify(name);
        if (!slug) return { success: false, error: 'Nombre inválido.' };

        const type = await prisma.variantType.create({
            data: { slug, variant_type_translations: { create: { locale: 'es', name } } }
        });

        await auditLog({ action: 'variant_type.create', entity_type: 'VariantType', entity_id: type.id, metadata: { name, slug } });
        revalidatePath('/es/admin/attributes');
        return { success: true };
    } catch (e) {
        if (e instanceof AuthorizationError) return { success: false, error: e.message };
        if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
            return { success: false, error: 'Ya existe un atributo con ese nombre.' };
        }
        return { success: false, error: 'No se pudo crear el atributo.' };
    }
}

export async function deleteVariantType(id: string) {
    try {
        await requireAdmin(undefined, 'products.manage');
        await prisma.variantType.delete({ where: { id } });
        await auditLog({ action: 'variant_type.delete', entity_type: 'VariantType', entity_id: id });
        revalidatePath('/es/admin/attributes');
        return { success: true };
    } catch (e) {
        if (e instanceof AuthorizationError) return { success: false, error: e.message };
        return { success: false, error: 'No se pudo eliminar el atributo (puede tener valores en uso en variantes existentes).' };
    }
}

export async function createVariantOption(variantTypeId: string, formData: FormData) {
    try {
        await requireAdmin(undefined, 'products.manage');
        const value = (formData.get('value') as string || '').trim();
        if (!value) return { success: false, error: 'El valor es obligatorio.' };
        const slug = slugify(value);
        if (!slug) return { success: false, error: 'Valor inválido.' };

        const maxSort = await prisma.variantOption.aggregate({
            where: { variant_type_id: variantTypeId },
            _max: { sort_order: true }
        });

        const option = await prisma.variantOption.create({
            data: {
                variant_type_id: variantTypeId,
                slug,
                sort_order: (maxSort._max.sort_order ?? -1) + 1,
                variant_option_translations: { create: { locale: 'es', value } }
            }
        });

        await auditLog({ action: 'variant_option.create', entity_type: 'VariantOption', entity_id: option.id, metadata: { variant_type_id: variantTypeId, value, slug } });
        revalidatePath('/es/admin/attributes');
        return { success: true };
    } catch (e) {
        if (e instanceof AuthorizationError) return { success: false, error: e.message };
        if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
            return { success: false, error: 'Ese valor ya existe para este atributo.' };
        }
        return { success: false, error: 'No se pudo crear el valor.' };
    }
}

export async function deleteVariantOption(id: string) {
    try {
        await requireAdmin(undefined, 'products.manage');
        await prisma.variantOption.delete({ where: { id } });
        await auditLog({ action: 'variant_option.delete', entity_type: 'VariantOption', entity_id: id });
        revalidatePath('/es/admin/attributes');
        return { success: true };
    } catch (e) {
        if (e instanceof AuthorizationError) return { success: false, error: e.message };
        return { success: false, error: 'No se pudo eliminar el valor (puede estar en uso en variantes existentes).' };
    }
}
