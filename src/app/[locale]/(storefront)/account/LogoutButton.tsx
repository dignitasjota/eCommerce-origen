'use client';

import { signOut } from 'next-auth/react';

export default function LogoutButton() {
    return (
        <button
            type="button"
            className="btn btn-outline"
            style={{ justifyContent: 'flex-start', border: 'none', color: 'var(--color-danger)', marginTop: '2rem' }}
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
        >
            Cerrar Sesión
        </button>
    );
}
