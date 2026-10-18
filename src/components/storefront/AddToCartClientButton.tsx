'use client';

import { useTranslations } from 'next-intl';
import { useCart } from '@/context/CartContext';
import { useRouter } from '@/i18n/navigation';
import { useState } from 'react';

interface Props {
    product: {
        id: string;
        name: string;
        price: string | number;
        image?: string;
        slug?: string;
        /**
         * Variante a añadir. Debe venir SIEMPRE que el producto tenga una única
         * variante activa (ver `getQuickAddInfo` en src/lib/inventory.ts): sin
         * ella el checkout no puede asignar almacén ni descontar stock.
         */
        variantId?: string | null;
        /** El producto tiene varias variantes: hay que elegir en la ficha. */
        requiresOptions?: boolean;
    };
    variantClass?: string;
    style?: React.CSSProperties;
}

export default function AddToCartClientButton({ product, variantClass = "btn btn-primary", style }: Props) {
    const t = useTranslations('product');
    const { addItem } = useCart();
    const router = useRouter();
    const [showToast, setShowToast] = useState(false);

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Producto con matriz de variantes: el botón rápido no sabe qué talla/
        // color quiere el cliente — lo llevamos a la ficha para que elija.
        if (product.requiresOptions && product.slug) {
            router.push(`/product/${product.slug}`);
            return;
        }

        const variantId = product.variantId ?? undefined;
        addItem({
            id: variantId ? `${product.id}-${variantId}` : product.id,
            product_id: product.id,
            variant_id: variantId,
            slug: product.slug,
            name: product.name,
            price: Number(product.price),
            quantity: 1,
            image: product.image,
        });

        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    return (
        <>
            <button className={variantClass} style={style || { width: '100%', marginTop: '1rem' }} onClick={handleAddToCart}>
                {product.requiresOptions ? 'Elegir opciones' : t('addToCart')}
            </button>

            {/* DaisyUI Toast - Visibilidad Alta */}
            {showToast && (
                <div style={{ position: 'fixed', top: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 999999, transition: 'all 0.3s ease-in-out' }}>
                    <div className="alert shadow-2xl" style={{ backgroundColor: '#22c55e', color: 'white', borderRadius: '1rem', padding: '1rem 2rem', fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                        <span>Añadido al carrito con éxito.</span>
                    </div>
                </div>
            )}
        </>
    );
}
