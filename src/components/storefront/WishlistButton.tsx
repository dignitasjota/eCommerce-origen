'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface WishlistButtonProps {
    productId: string;
    initialIsFavorited?: boolean;
    className?: string;
}

export default function WishlistButton({ productId, initialIsFavorited = false, className = '' }: WishlistButtonProps) {
    const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const toggleWishlist = async (e: React.MouseEvent) => {
        e.preventDefault(); // Evitar navegación si está dentro de un Link
        e.stopPropagation();

        setIsLoading(true);

        try {
            const res = await fetch('/api/storefront/wishlist', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ productId })
            });

            if (res.status === 401) {
                // Redirigir al login si no está autenticado
                router.push('/auth/login');
                return;
            }

            if (!res.ok) {
                throw new Error('Error al actualizar wishlist');
            }

            const data = await res.json();

            if (data.action === 'added') setIsFavorited(true);
            if (data.action === 'removed') setIsFavorited(false);

            router.refresh(); // Refrescar para sincronizar estado de Next.js
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={toggleWishlist}
            disabled={isLoading}
            className={`wishlist-btn ${className}`}
            style={{
                background: 'transparent',
                border: 'none',
                cursor: isLoading ? 'wait' : 'pointer',
                padding: '0.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.2s',
                transform: isFavorited ? 'scale(1.1)' : 'scale(1)'
            }}
            aria-label={isFavorited ? 'Quitar de la lista de deseos' : 'Añadir a la lista de deseos'}
            title={isFavorited ? 'Quitar de la lista de deseos' : 'Añadir a la lista de deseos'}
        >
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill={isFavorited ? 'var(--color-danger)' : 'none'}
                stroke={isFavorited ? 'var(--color-danger)' : 'currentColor'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-colors duration-300`}
            >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
        </button>
    );
}
