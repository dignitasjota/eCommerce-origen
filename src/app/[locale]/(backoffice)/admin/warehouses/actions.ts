'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { requireAdmin, AuthorizationError } from '@/lib/auth';
import { auditLog } from '@/lib/audit';

/** Extrae mensaje/código de un `unknown` de catch sin recurrir a `any`. */
function errorInfo(error: unknown): { message?: string; code?: string } {
    if (typeof error !== 'object' || error === null) return {};
    const message = 'message' in error && typeof error.message === 'string' ? error.message : undefined;
    const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
    return { message, code };
}

interface WarehouseInput {
    name: string;
    code: string;
    address1: string;
    address2: string;
    city: string;
    postal_code: string;
    country: string;
    priority: string;
    is_active: boolean;
    is_dropshipping: boolean;
}

function parseWarehouse(input: WarehouseInput) {
    const name = (input.name || '').trim();
    if (!name) throw new Error('El nombre del almacén es obligatorio.');

    const code = (input.code || '').trim().toUpperCase();
    if (!code) throw new Error('El código del almacén es obligatorio.');

    const priority = parseInt(input.priority || '0', 10);
    if (!Number.isInteger(priority)) throw new Error('Prioridad inválida.');

    return {
        name,
        code,
        address1: input.address1?.trim() || null,
        address2: input.address2?.trim() || null,
        city: input.city?.trim() || null,
        postal_code: input.postal_code?.trim() || null,
        country: input.country?.trim().toUpperCase() || 'ES',
        priority,
        is_active: !!input.is_active,
        is_dropshipping: !!input.is_dropshipping
    };
}

export async function createWarehouse(input: WarehouseInput) {
    try {
        await requireAdmin(undefined, 'warehouses.manage');
        const data = parseWarehouse(input);

        const created = await prisma.warehouse.create({ data });

        await auditLog({
            action: 'warehouse.create',
            entity_type: 'Warehouse',
            entity_id: created.id,
            metadata: { name: data.name, code: data.code, is_dropshipping: data.is_dropshipping }
        });

        revalidatePath('/[locale]/admin/warehouses', 'page');
        return { success: true };
    } catch (error: unknown) {
        if (error instanceof AuthorizationError) return { success: false, error: error.message };
        const { message, code } = errorInfo(error);
        if (code === 'P2002') return { success: false, error: 'Ya existe un almacén con ese código.' };
        return { success: false, error: message || 'No se pudo crear el almacén.' };
    }
}

export async function updateWarehouse(id: string, input: WarehouseInput) {
    try {
        await requireAdmin(undefined, 'warehouses.manage');
        const data = parseWarehouse(input);

        const existing = await prisma.warehouse.findUnique({ where: { id } });
        if (!existing) return { success: false, error: 'Almacén no encontrado.' };

        await prisma.warehouse.update({ where: { id }, data });

        await auditLog({
            action: 'warehouse.update',
            entity_type: 'Warehouse',
            entity_id: id,
            metadata: { name: data.name, code: data.code, is_active: data.is_active, is_dropshipping: data.is_dropshipping }
        });

        revalidatePath('/[locale]/admin/warehouses', 'page');
        return { success: true };
    } catch (error: unknown) {
        if (error instanceof AuthorizationError) return { success: false, error: error.message };
        const { message, code } = errorInfo(error);
        if (code === 'P2002') return { success: false, error: 'Ya existe un almacén con ese código.' };
        return { success: false, error: message || 'No se pudo actualizar el almacén.' };
    }
}

export async function deleteWarehouse(id: string) {
    try {
        await requireAdmin(undefined, 'warehouses.manage');

        const totalActive = await prisma.warehouse.count({ where: { is_active: true } });
        const target = await prisma.warehouse.findUnique({ where: { id }, select: { is_active: true } });
        if (target?.is_active && totalActive <= 1) {
            return { success: false, error: 'No se puede eliminar el único almacén activo — el checkout necesita al menos uno.' };
        }

        await prisma.warehouse.delete({ where: { id } });

        await auditLog({ action: 'warehouse.delete', entity_type: 'Warehouse', entity_id: id });

        revalidatePath('/[locale]/admin/warehouses', 'page');
        return { success: true };
    } catch (error: unknown) {
        if (error instanceof AuthorizationError) return { success: false, error: error.message };
        const { message, code } = errorInfo(error);
        if (code === 'P2003') {
            return { success: false, error: 'El almacén tiene stock o pedidos asociados; desactívalo en su lugar de borrarlo.' };
        }
        return { success: false, error: message || 'No se pudo eliminar el almacén.' };
    }
}
