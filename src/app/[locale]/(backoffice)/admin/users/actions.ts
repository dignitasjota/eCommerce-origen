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

    const addressData = role === 'CUSTOMER' ? {
        first_name: formData.get('first_name') as string,
        last_name: formData.get('last_name') as string,
        address1: formData.get('address1') as string,
        city: formData.get('city') as string,
        postal_code: formData.get('postal_code') as string,
        country: formData.get('country') as string || 'España',
        state: formData.get('state') as string,
    } : null;

    try {
        await prisma.user.create({
            data: {
                name,
                email,
                phone,
                role,
                password_hash: hashedPassword,
                ...(addressData && addressData.address1 ? {
                    addresses: {
                        create: {
                            ...addressData,
                            is_default: true
                        }
                    }
                } : {})
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

    // Address extraction
    const addressId = formData.get('address_id') as string;
    const addressData = role === 'CUSTOMER' ? {
        first_name: formData.get('first_name') as string,
        last_name: formData.get('last_name') as string,
        address1: formData.get('address1') as string,
        city: formData.get('city') as string,
        postal_code: formData.get('postal_code') as string,
        country: formData.get('country') as string || 'España',
        state: formData.get('state') as string,
    } : null;

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
        // En Prisma es difícil hacer un UPSERT anidado limpio si puede haber campos incompletos,  
        // por lo que primero actualizamos el usuario principal.
        await prisma.user.update({
            where: { id },
            data: dataToUpdate
        });

        // Si es cliente y rellenó al menos la dirección 1...
        if (addressData && addressData.address1) {
            if (addressId) {
                // Actualiza dirección existente
                await prisma.address.update({
                    where: { id: addressId },
                    data: addressData
                });
            } else {
                // Crea una nueva dirección prederminada para él
                await prisma.address.create({
                    data: {
                        ...addressData,
                        user_id: id,
                        is_default: true
                    }
                });
            }
        }

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
