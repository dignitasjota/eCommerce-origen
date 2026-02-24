'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

export async function createUser(formData: FormData) {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const role = formData.get('role') as 'ADMIN' | 'ORDER_MANAGER' | 'CUSTOMER';
    const password = formData.get('password') as string;

    if (!email || !password) {
        throw new Error('El email y la contraseña son obligatorios');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await prisma.user.create({
            data: {
                name,
                email,
                phone,
                role,
                password_hash: hashedPassword,
            }
        });
        revalidatePath('/es/admin/users');
    } catch (error: any) {
        if (error.code === 'P2002') {
            throw new Error('Ese email ya está registrado.');
        }
        throw new Error('No se pudo crear el usuario.');
    }
}

export async function updateUser(id: string, formData: FormData) {
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const role = formData.get('role') as 'ADMIN' | 'ORDER_MANAGER' | 'CUSTOMER';
    const password = formData.get('password') as string;

    const dataToUpdate: any = {
        name,
        email,
        phone,
        role,
    };

    if (password) {
        dataToUpdate.password_hash = await bcrypt.hash(password, 10);
    }

    try {
        await prisma.user.update({
            where: { id },
            data: dataToUpdate
        });
        revalidatePath('/es/admin/users');
    } catch (error: any) {
        if (error.code === 'P2002') {
            throw new Error('Ese email ya está en uso por otro usuario.');
        }
        throw new Error('No se pudo actualizar el usuario.');
    }
}

export async function deleteUser(id: string) {
    try {
        await prisma.user.delete({
            where: { id }
        });
        revalidatePath('/es/admin/users');
    } catch (error: any) {
        throw new Error('No se puede eliminar un usuario con pedidos o registros vinculados. Modifica su rol o correo en su lugar.');
    }
}
