'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCart } from '@/context/CartContext';
import { isLowStock } from '@/lib/inventory';

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
    unlimitedStock: boolean;
    /** Hay algún almacén de drop shipping activo: capacidad virtual, nunca "agotado". */
    hasDropshipping?: boolean;
    productSlug?: string;
}

export default function AddToCartForm({ productId, productName, image, basePrice, variants, attributes, unlimitedStock, hasDropshipping = false, productSlug }: AddToCartFormProps) {
    const t = useTranslations('product');
    const { addItem } = useCart();
    // Primera opción de cada atributo preseleccionada desde el estado inicial
    // (antes se hacía en un useEffect: el primer render no tenía selección y
    // mostraba el botón en estado incorrecto hasta el segundo render).
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        // Preferimos las opciones de una variante real (con stock si la hay)
        // para no arrancar en una combinación inexistente.
        const complete = variants.filter(v => v.options.length === attributes.length && v.options.length > 0);
        const preferred = complete.find(v => v.stock > 0) ?? complete[0];
        if (preferred) {
            preferred.options.forEach(opt => { initial[opt.attributeId] = opt.optionId; });
            return initial;
        }
        attributes.forEach(attr => {
            if (attr.options.length > 0) initial[attr.id] = attr.options[0].id;
        });
        return initial;
    });
    const [quantity, setQuantity] = useState(1);
    const [showToast, setShowToast] = useState(false);


    // Find the variant that matches selected options
    // Coincidencia EXACTA: misma cantidad de opciones que atributos y todas
    // seleccionadas. Antes bastaba con `every`, que es `true` sobre un array
    // vacío — la variante base (sin opciones) "coincidía" con cualquier
    // selección y, según el orden de la BD, se añadía al carrito en lugar de
    // la talla/color elegidos.
    const selectedVariant = variants.find(v =>
        v.options.length === attributes.length &&
        v.options.every(opt => selectedOptions[opt.attributeId] === opt.optionId)
    );

    const currentPrice = selectedVariant?.price || basePrice;
    // `stock` es el total de almacenes físicos: con stock ilimitado o con un
    // almacén de drop shipping activo (capacidad virtual) nunca está agotado.
    const alwaysAvailable = unlimitedStock || hasDropshipping;
    const noMatchingVariant = variants.length > 0 && !selectedVariant;
    const isOutOfStock = noMatchingVariant || (!!selectedVariant && !alwaysAvailable && selectedVariant.stock <= 0);
    const showLowStock = selectedVariant ? isLowStock(selectedVariant.stock, alwaysAvailable) : false;

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
            slug: productSlug,
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
                        onClick={() => setQuantity(Math.min(99, quantity + 1))}
                        style={{ padding: '0.75rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >+</button>
                </div>
                <button
                    onClick={handleAddToCart}
                    disabled={isOutOfStock}
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '0.75rem 2rem', fontSize: '1.1rem' }}
                >
                    {noMatchingVariant ? 'Combinación no disponible' : isOutOfStock ? 'Agotado' : t('addToCart')}
                </button>
            </div>

            {showLowStock && (
                <p role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-danger)', fontWeight: 600, fontSize: '0.9rem', marginTop: '0.75rem' }}>
                    <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    ¡Solo quedan {selectedVariant!.stock} unidades disponibles!
                </p>
            )}

            {/* DaisyUI Toast - Visibilidad Alta */}
            {showToast && (
                <div style={{ position: 'fixed', top: '2rem', left: '50%', transform: 'translateX(-50%)', zIndex: 999999, transition: 'all 0.3s ease-in-out' }}>
                    <div className="alert shadow-2xl" style={{ backgroundColor: '#22c55e', color: 'white', borderRadius: '1rem', padding: '1rem 2rem', fontWeight: 600, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                        <span>Añadido al carrito con éxito.</span>
                    </div>
                </div>
            )}
        </div>
    );
}
