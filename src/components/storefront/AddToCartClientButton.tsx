'use client';

import { useTranslations } from 'next-intl';
import { useCart } from '@/context/CartContext';
import { useState } from 'react';

interface Props {
    product: {
        id: string;
        name: string;
        price: string | number;
        image?: string;
        variantId?: string;
    };
    variantClass?: string;
    style?: React.CSSProperties;
}

export default function AddToCartClientButton({ product, variantClass = "btn btn-primary", style }: Props) {
    const t = useTranslations('product');
    const { addItem } = useCart();
    const [showToast, setShowToast] = useState(false);

    const handleAddToCart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        addItem({
            id: product.variantId ? `${product.id}-${product.variantId}` : product.id,
            product_id: product.id,
            variant_id: product.variantId,
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
                {t('addToCart')}
            </button>

            {/* DaisyUI Toast - Visibilidad Alta */}
            {showToast && (
                <div style={{ position: 'fixed', top: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 999999, transition: 'all 0.3s ease-in-out' }}>
                    <div className="alert shadow-2xl" style={{ backgroundColor: '#22c55e', color: 'white', borderRadius: '1rem', padding: '1rem 2rem', fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                        <span>Añadido al carrito con éxito.</span>
                    </div>
                </div>
            )}
        </>
    );
}

