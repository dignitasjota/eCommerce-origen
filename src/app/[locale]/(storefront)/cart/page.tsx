'use client';

import { useCart } from '@/context/CartContext';
import { Link } from '@/i18n/navigation';
import { useEffect, useState } from 'react';

export default function CartPage() {
    const { state, removeItem, updateQuantity } = useCart();
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch for localStorage dependent states
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const SHIPPING_COST = 4.99; // Envío estático por defecto (cambiará en el checkout real)
    const FREE_SHIPPING_THRESHOLD = 50;

    const shipping = state.subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    const total = state.subtotal + shipping;

    const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - state.subtotal);

    if (state.items.length === 0) {
        return (
            <div className="container" style={{ padding: '6rem 1rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Tu Carrito</h1>
                <div style={{ backgroundColor: 'var(--color-background-soft)', padding: '4rem 2rem', borderRadius: 'var(--radius-lg)', maxWidth: '600px', margin: '0 auto' }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 1.5rem', opacity: 0.3 }}>
                        <circle cx="8" cy="21" r="1" />
                        <circle cx="19" cy="21" r="1" />
                        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                    </svg>
                    <p style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>Aún no tienes artículos en tu carrito.</p>
                    <Link href="/products" className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}>
                        Explorar la tienda
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={{ padding: '3rem 1rem 6rem' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '2rem' }}>Tu Carrito</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 380px)', gap: '3rem', alignItems: 'flex-start' }}>

                {/* Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                <th style={{ paddingBottom: '1rem', fontWeight: 'normal' }}>Producto</th>
                                <th style={{ paddingBottom: '1rem', fontWeight: 'normal', textAlign: 'center' }}>Cantidad</th>
                                <th style={{ paddingBottom: '1rem', fontWeight: 'normal', textAlign: 'right' }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {state.items.map((item) => (
                                <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>

                                    {/* Product Details Columns */}
                                    <td style={{ padding: '1.5rem 0', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                        <div style={{ width: '100px', height: '100px', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0 }}>
                                            {item.image ? (
                                                <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /></svg>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <Link href={`/product/${item.product_id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                <h3 style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{item.name}</h3>
                                            </Link>

                                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                                {item.price.toFixed(2)} €
                                            </div>

                                            {item.attributes && Object.entries(item.attributes).map(([key, value]) => (
                                                <div key={key} style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
                                                    {key}: {value}
                                                </div>
                                            ))}
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', fontSize: '0.85rem', cursor: 'pointer', padding: 0, marginTop: '0.5rem', textDecoration: 'underline' }}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </td>

                                    {/* Quantity Column */}
                                    <td style={{ padding: '1.5rem 0', textAlign: 'center', verticalAlign: 'middle' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>-</button>
                                            <span style={{ width: '2rem', textAlign: 'center', fontSize: '0.9rem' }}>{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>+</button>
                                        </div>
                                    </td>

                                    {/* Item Total Column */}
                                    <td style={{ padding: '1.5rem 0', textAlign: 'right', verticalAlign: 'middle', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                                        {(item.price * item.quantity).toFixed(2)} €
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Summary Box */}
                <div style={{ backgroundColor: 'var(--color-background-soft)', padding: '2rem', borderRadius: 'var(--radius-lg)' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Resumen del pedido</h2>

                    {/* Free shipping progress bar */}
                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                            {amountToFreeShipping > 0 ? (
                                <span>Te faltan <strong>{amountToFreeShipping.toFixed(2)} €</strong> para envío gratis</span>
                            ) : (
                                <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>¡Tienes envío GRATIS! 🎉</span>
                            )}
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                                style={{
                                    height: '100%',
                                    backgroundColor: amountToFreeShipping > 0 ? 'var(--color-primary)' : 'var(--color-success)',
                                    width: `${Math.min(100, (state.subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%`,
                                    transition: 'width 0.3s ease, background-color 0.3s ease'
                                }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal</span>
                            <span>{state.subtotal.toFixed(2)} €</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-text-secondary)' }}>Envío estimado</span>
                            <span>{shipping === 0 ? 'Gratis' : `${shipping.toFixed(2)} €`}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
                        <span>Total</span>
                        <span style={{ color: 'var(--color-primary)' }}>{total.toFixed(2)} €</span>
                    </div>

                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem', textAlign: 'center' }}>
                        Los impuestos se calculan al finalizar la compra
                    </p>

                    <Link href="/checkout" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                        Proceder al Pago
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                    </Link>

                    {/* Trust badges */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '2rem', opacity: 0.5 }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect width="20" height="14" x="2" y="5" rx="2" /><circle cx="12" cy="12" r="2" /></svg>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    </div>
                </div>
            </div>
        </div>
    );
}
