'use client';

import { useState, FormEvent } from 'react';
import { useCart } from '@/context/CartContext';
import { useRouter } from '@/i18n/navigation';

interface ShippingMethod {
    id: string;
    price: number;
    free_above: number | null;
    name: string;
    description: string;
    estimated_days: string;
}

interface AddressData {
    firstName: string;
    lastName: string;
    address1: string;
    address2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone: string;
}

interface CheckoutClientProps {
    shippingMethods: ShippingMethod[];
    initialEmail?: string;
    initialName?: string;
    initialAddress?: AddressData | null;
}

export default function CheckoutClient({ shippingMethods, initialEmail, initialName, initialAddress }: CheckoutClientProps) {
    const { state, clearCart } = useCart();
    const router = useRouter();

    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Form States
    const [email, setEmail] = useState(initialEmail || '');
    const [address, setAddress] = useState<AddressData>(initialAddress || {
        firstName: initialName || '',
        lastName: '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'España',
        phone: ''
    });

    // Envío y Pago
    const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<string>(
        shippingMethods.length > 0 ? shippingMethods[0].id : ''
    );
    const [paymentMethod, setPaymentMethod] = useState<'COD' | 'TRANSFER'>('COD');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Calcular Envío dinámico
    const selectedMethod = shippingMethods.find(m => m.id === selectedShippingMethodId);
    let shippingCost = selectedMethod?.price || 0;

    // Aplicar lógica Free Shipping si el método lo soporta
    if (selectedMethod?.free_above && state.subtotal >= selectedMethod.free_above) {
        shippingCost = 0;
    }

    const total = state.subtotal + shippingCost;

    const handleNextStep = (e: FormEvent) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setStep(prev => (prev < 3 ? prev + 1 : prev) as 1 | 2 | 3);
    };

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setAddress(prev => ({ ...prev, [name]: value }));
    };

    const submitOrder = async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            const payload = {
                email,
                address,
                shippingMethodId: selectedShippingMethodId,
                paymentMethod,
                items: state.items
            };

            const response = await fetch('/api/storefront/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ocurrió un error al procesar el pedido');
            }

            // Éxito
            clearCart();
            router.push(`/checkout/success/${data.orderId}`);

        } catch (err: any) {
            setError(err.message);
            setIsSubmitting(false);
        }
    };

    if (state.items.length === 0 && !isSubmitting) {
        return (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Tu carrito está vacío</h1>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>Añade algunos productos antes de finalizar la compra.</p>
                <button onClick={() => router.push('/products')} className="btn btn-primary">Volver a la tienda</button>
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 400px)', gap: '4rem', alignItems: 'flex-start' }}>

            {/* Control Principal (Pasos) */}
            <div>
                {/* Breadcrumbs / Pasos Visuales */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '3rem', fontSize: '0.9rem', color: 'var(--color-text-tertiary)' }}>
                    <span style={{ color: step >= 1 ? 'var(--color-primary)' : 'inherit', fontWeight: step >= 1 ? 'bold' : 'normal' }}>1. Contacto</span>
                    <span>/</span>
                    <span style={{ color: step >= 2 ? 'var(--color-primary)' : 'inherit', fontWeight: step >= 2 ? 'bold' : 'normal' }}>2. Envío</span>
                    <span>/</span>
                    <span style={{ color: step >= 3 ? 'var(--color-primary)' : 'inherit', fontWeight: step >= 3 ? 'bold' : 'normal' }}>3. Pago</span>
                </div>

                {error && (
                    <div style={{ backgroundColor: 'var(--color-danger)', color: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
                        {error}
                    </div>
                )}

                {/* Paso 1: Contacto */}
                {step === 1 && (
                    <form onSubmit={handleNextStep}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Información de Contacto</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
                            <label htmlFor="email" style={{ fontWeight: 'bold' }}>Correo Electrónico</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="form-input"
                                placeholder="tu@email.com"
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}>
                            Continuar con el Envío
                        </button>
                    </form>
                )}

                {/* Paso 2: Envío */}
                {step === 2 && (
                    <form onSubmit={handleNextStep}>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Dirección de Envío</h2>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <label className="form-label">Nombre</label>
                                <input type="text" name="firstName" value={address.firstName} onChange={handleAddressChange} required className="form-input" />
                            </div>
                            <div>
                                <label className="form-label">Apellidos</label>
                                <input type="text" name="lastName" value={address.lastName} onChange={handleAddressChange} required className="form-input" />
                            </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Dirección Postal</label>
                            <input type="text" name="address1" value={address.address1} onChange={handleAddressChange} required className="form-input" placeholder="Calle, número, piso" />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Apartamento, local, etc. (Opcional)</label>
                            <input type="text" name="address2" value={address.address2} onChange={handleAddressChange} className="form-input" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <label className="form-label">Ciudad</label>
                                <input type="text" name="city" value={address.city} onChange={handleAddressChange} required className="form-input" />
                            </div>
                            <div>
                                <label className="form-label">Código Postal</label>
                                <input type="text" name="postalCode" value={address.postalCode} onChange={handleAddressChange} required className="form-input" />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                            <div>
                                <label className="form-label">Provincia / Región</label>
                                <input type="text" name="state" value={address.state} onChange={handleAddressChange} required className="form-input" />
                            </div>
                            <div>
                                <label className="form-label">Teléfono</label>
                                <input type="tel" name="phone" value={address.phone} onChange={handleAddressChange} required className="form-input" />
                            </div>
                        </div>

                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Método de Envío</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                            {shippingMethods.map(method => {
                                const isFree = method.free_above && state.subtotal >= method.free_above;
                                const cost = isFree ? 0 : method.price;

                                return (
                                    <label key={method.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: selectedShippingMethodId === method.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', backgroundColor: selectedShippingMethodId === method.id ? 'var(--color-background-soft)' : 'transparent' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <input
                                                type="radio"
                                                name="shippingMethod"
                                                value={method.id}
                                                checked={selectedShippingMethodId === method.id}
                                                onChange={(e) => setSelectedShippingMethodId(e.target.value)}
                                            />
                                            <div>
                                                <div style={{ fontWeight: 'bold' }}>{method.name}</div>
                                                {method.estimated_days && <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{method.estimated_days}</div>}
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                            {cost === 0 ? 'Gratis' : `${cost.toFixed(2)} €`}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button type="button" onClick={() => setStep(1)} className="btn btn-outline" style={{ flex: 1 }}>Volver</button>
                            <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '1rem', fontSize: '1.1rem' }}>Continuar al Pago</button>
                        </div>
                    </form>
                )}

                {/* Paso 3: Pago */}
                {step === 3 && (
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Método de Pago</h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '3rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', border: paymentMethod === 'COD' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', backgroundColor: paymentMethod === 'COD' ? 'var(--color-background-soft)' : 'transparent' }}>
                                <input
                                    type="radio"
                                    value="COD"
                                    checked={paymentMethod === 'COD'}
                                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                                />
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>Pago a la Entrega (Contrareembolso)</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Paga en efectivo al recibir tu pedido.</div>
                                </div>
                            </label>

                            <label style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', border: paymentMethod === 'TRANSFER' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', backgroundColor: paymentMethod === 'TRANSFER' ? 'var(--color-background-soft)' : 'transparent' }}>
                                <input
                                    type="radio"
                                    value="TRANSFER"
                                    checked={paymentMethod === 'TRANSFER'}
                                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                                />
                                <div>
                                    <div style={{ fontWeight: 'bold' }}>Transferencia Bancaria</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Te enviaremos los datos por email. El pedido no se procesará hasta recibir el pago.</div>
                                </div>
                            </label>
                        </div>

                        <div style={{ backgroundColor: 'var(--color-background-soft)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
                            <h3 style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Resumen de Entrega</h3>
                            <p style={{ margin: 0 }}><strong>Contacto:</strong> {email}</p>
                            <p style={{ margin: '0.5rem 0' }}><strong>Dirección:</strong> {address.address1}, {address.city} {address.postalCode}</p>
                            <p style={{ margin: 0 }}><strong>Envío:</strong> {selectedMethod?.name}</p>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button type="button" onClick={() => setStep(2)} className="btn btn-outline" style={{ flex: 1 }} disabled={isSubmitting}>Volver</button>
                            <button onClick={submitOrder} disabled={isSubmitting} className="btn btn-primary" style={{ flex: 2, padding: '1rem', fontSize: '1.1rem', backgroundColor: 'var(--color-success)' }}>
                                {isSubmitting ? 'Procesando...' : `Pagar ${total.toFixed(2)} €`}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Sumario Lateral */}
            <div style={{ backgroundColor: 'var(--color-background-soft)', padding: '2rem', borderRadius: 'var(--radius-lg)', position: 'sticky', top: '6rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Resumen de Compra ({state.totalQuantity})</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', maxHeight: '350px', overflowY: 'auto' }}>
                    {state.items.map(item => (
                        <div key={item.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ width: '60px', height: '60px', backgroundColor: 'var(--color-background)', borderRadius: 'var(--radius-md)', overflow: 'hidden', position: 'relative' }}>
                                {item.image && <img src={item.image} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                <span style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: 'var(--color-text-secondary)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                    {item.quantity}
                                </span>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{item.name}</div>
                                {item.attributes && Object.entries(item.attributes).map(([key, value]) => (
                                    <div key={key} style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>{key}: {value}</div>
                                ))}
                            </div>
                            <div style={{ fontWeight: 'bold' }}>
                                {(item.price * item.quantity).toFixed(2)} €
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                        <span>Subtotal</span>
                        <span>{state.subtotal.toFixed(2)} €</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                        <span>Envío</span>
                        <span>{shippingCost === 0 ? 'Gratis' : `${shippingCost.toFixed(2)} €`}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', fontSize: '1.5rem', fontWeight: 'bold' }}>
                        <span>Total a pagar</span>
                        <span style={{ color: 'var(--color-primary)' }}>{total.toFixed(2)} €</span>
                    </div>
                </div>
            </div>

        </div>
    );
}
