'use client';

import { useCart } from '@/context/CartContext';
import { Link } from '@/i18n/navigation';
import { useEffect } from 'react';

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
    const { state, removeItem, updateQuantity } = useCart();

    // Prevent scrolling when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    // Although we return the structure, we use CSS opacity/transform for smooth opening
    // But for simplicity, we'll conditionally render the backdrop and position the drawer

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        zIndex: 9998,
                        animation: 'fadeIn 0.3s ease'
                    }}
                />
            )}

            {/* Drawer */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    right: isOpen ? 0 : '-400px',
                    bottom: 0,
                    width: '100%',
                    maxWidth: '400px',
                    backgroundColor: 'var(--color-background)',
                    zIndex: 9999,
                    boxShadow: isOpen ? '-4px 0 15px rgba(0,0,0,0.1)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'right 0.3s ease'
                }}
            >
                {/* Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Tu Carrito ({state.totalQuantity})</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: '0.5rem' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>

                {/* Items */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                    {state.items.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginTop: '2rem' }}>
                            <p>Tu carrito está vacío.</p>
                            <button onClick={onClose} className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
                                Seguir Comprando
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {state.items.map((item) => (
                                <div key={item.id} style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-md)', overflow: 'hidden', flexShrink: 0 }}>
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.2 }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /></svg>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <h3 style={{ fontWeight: 'bold', fontSize: '0.9rem', lineHeight: '1.2' }}>{item.name}</h3>
                                                <button onClick={() => removeItem(item.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', padding: 0 }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                                </button>
                                            </div>
                                            {item.attributes && Object.entries(item.attributes).map(([key, value]) => (
                                                <div key={key} style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                                                    {key}: {value}
                                                </div>
                                            ))}
                                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-primary)', marginTop: '0.25rem' }}>
                                                {item.price.toFixed(2)} €
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.5rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', width: 'fit-content' }}>
                                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} style={{ padding: '0.2rem 0.5rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>-</button>
                                            <span style={{ padding: '0 0.5rem', fontSize: '0.875rem' }}>{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} style={{ padding: '0.2rem 0.5rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>+</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {state.items.length > 0 && (
                    <div style={{ padding: '1.5rem', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-background-soft)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontWeight: 'bold', fontSize: '1.1rem' }}>
                            <span>Subtotal</span>
                            <span>{state.subtotal.toFixed(2)} €</span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '1rem', textAlign: 'center' }}>
                            Impuestos y envíos calculados en el checkout.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <Link href="/cart" onClick={onClose} className="btn btn-outline" style={{ width: '100%', textAlign: 'center', padding: '0.75rem' }}>
                                Ver Carrito Completo
                            </Link>
                            <Link href="/checkout" onClick={onClose} className="btn btn-primary" style={{ width: '100%', textAlign: 'center', padding: '0.75rem' }}>
                                Proceder al Pago
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
