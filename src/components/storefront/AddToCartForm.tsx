'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useCart } from '@/context/CartContext';

interface VariantOption {
    attributeId: string;
    attributeName: string;
    optionId: string;
    optionName: string;
}

interface Variant {
    id: string;
    price: string;
    stock: number;
    options: VariantOption[];
}

interface Attribute {
    id: string;
    name: string;
    options: { id: string; name: string }[];
}

interface AddToCartFormProps {
    productId: string;
    productName: string;
    image?: string;
    basePrice: string;
    variants: Variant[];
    attributes: Attribute[];
}

export default function AddToCartForm({ productId, productName, image, basePrice, variants, attributes }: AddToCartFormProps) {
    const t = useTranslations('product');
    const { addItem } = useCart();
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
    const [quantity, setQuantity] = useState(1);
    const [showToast, setShowToast] = useState(false);

    // Automatically select first option for each attribute if available
    useEffect(() => {
        if (attributes.length > 0 && Object.keys(selectedOptions).length === 0) {
            const initial: Record<string, string> = {};
            attributes.forEach(attr => {
                if (attr.options.length > 0) {
                    initial[attr.id] = attr.options[0].id;
                }
            });
            setSelectedOptions(initial);
        }
    }, [attributes]);

    // Find the variant that matches selected options
    const selectedVariant = variants.find(v => {
        return v.options.every(opt => selectedOptions[opt.attributeId] === opt.optionId);
    });

    const currentPrice = selectedVariant?.price || basePrice;
    const isOutOfStock = selectedVariant ? selectedVariant.stock <= 0 : false;

    const handleOptionChange = (attributeId: string, optionId: string) => {
        setSelectedOptions(prev => ({
            ...prev,
            [attributeId]: optionId
        }));
    };

    const handleAddToCart = () => {
        const optionNames: Record<string, string> = {};
        if (selectedVariant) {
            selectedVariant.options.forEach(opt => {
                optionNames[opt.attributeName] = opt.optionName;
            });
        }

        addItem({
            id: selectedVariant ? `${productId}-${selectedVariant.id}` : productId,
            product_id: productId,
            variant_id: selectedVariant?.id,
            name: productName,
            price: Number(currentPrice),
            quantity,
            image,
            attributes: Object.keys(optionNames).length > 0 ? optionNames : undefined
        });

        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    return (
        <div style={{ marginTop: '2rem' }}>
            {/* Price Override (if variant selected) */}
            {attributes.length > 0 && selectedVariant && (
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '1.5rem' }}>
                    Precio: {currentPrice} €
                </div>
            )}

            {/* Variant Selectors */}
            {attributes.map(attr => (
                <div key={attr.id} style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        {attr.name}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {attr.options.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => handleOptionChange(attr.id, opt.id)}
                                style={{
                                    padding: '0.5rem 1rem',
                                    borderRadius: 'var(--radius-md)',
                                    border: selectedOptions[attr.id] === opt.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                    backgroundColor: selectedOptions[attr.id] === opt.id ? 'var(--color-primary-light)' : 'transparent',
                                    cursor: 'pointer',
                                    fontWeight: selectedOptions[attr.id] === opt.id ? 'bold' : 'normal'
                                }}
                            >
                                {opt.name}
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            {/* Quantity and Add to Cart */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >-</button>
                    <span style={{ width: '3rem', textAlign: 'center', fontWeight: 'bold' }}>{quantity}</span>
                    <button
                        onClick={() => setQuantity(quantity + 1)}
                        style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >+</button>
                </div>
                <button
                    onClick={handleAddToCart}
                    disabled={isOutOfStock}
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '0.75rem 2rem', fontSize: '1.1rem' }}
                >
                    {isOutOfStock ? 'Agotado' : t('addToCart')}
                </button>
            </div>

            {/* DaisyUI Toast - Visibilidad Alta */}
            {showToast && (
                <div style={{ position: 'fixed', top: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 999999, transition: 'all 0.3s ease-in-out' }}>
                    <div className="alert shadow-2xl" style={{ backgroundColor: '#22c55e', color: 'white', borderRadius: '1rem', padding: '1rem 2rem', fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                        <span>Añadido al carrito con éxito.</span>
                    </div>
                </div>
            )}
        </div>
    );
}
