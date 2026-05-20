import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import ReturnManagerForm from './ReturnManagerForm';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
    REQUESTED: 'Solicitada',
    APPROVED: 'Aprobada',
    REJECTED: 'Rechazada',
    RECEIVED: 'Recibida',
    REFUNDED: 'Reembolsada',
    CANCELLED: 'Cancelada'
};

const CONDITION_LABELS: Record<string, string> = {
    UNOPENED: 'Sin abrir',
    OPENED: 'Abierto',
    DAMAGED: 'Dañado',
    USED: 'Usado'
};

export default async function ReturnDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const ret = await prisma.return.findUnique({
        where: { id },
        include: {
            users: { select: { name: true, email: true } },
            orders: {
                select: {
                    id: true,
                    order_number: true,
                    total: true,
                    payment_method: true,
                    payment_intent_id: true,
                    guest_email: true,
                    guest_name: true
                }
            },
            return_items: {
                include: {
                    order_items: {
                        select: { id: true, name: true, sku: true, price: true, quantity: true }
                    }
                }
            }
        }
    });

    if (!ret) notFound();

    const customerName = ret.users?.name || ret.orders.guest_name || '—';
    const customerEmail = ret.users?.email || ret.orders.guest_email || '—';
    const isStripe = !!ret.orders.payment_intent_id;

    // Calculamos el total potencial a reembolsar (precio × cantidad de cada item devuelto).
    const suggestedRefund = ret.return_items.reduce((acc, ri) => {
        return acc + Number(ri.order_items.price) * ri.quantity;
    }, 0);

    return (
        <>
            <div className="admin-topbar" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <Link href="/es/admin/returns" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
                    ← Volver
                </Link>
                <h1 className="admin-topbar-title">Devolución {ret.return_number}</h1>
                <span className={`admin-badge ${ret.status === 'REFUNDED' || ret.status === 'RECEIVED' ? 'active' : 'inactive'}`}>
                    {STATUS_LABELS[ret.status]}
                </span>
            </div>

            <div className="admin-page" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'flex-start' }}>
                {/* Columna izquierda: detalles + items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="admin-table-container" style={{ padding: '1.25rem' }}>
                        <h2 className="admin-table-title">Resumen</h2>
                        <table className="admin-table" style={{ marginBottom: 0 }}>
                            <tbody>
                                <tr>
                                    <td><strong>Pedido</strong></td>
                                    <td>
                                        <Link href={`/es/admin/orders/${ret.order_id}`} className="text-primary hover:underline">
                                            {ret.orders.order_number}
                                        </Link>
                                        {' · '}
                                        Total: {Number(ret.orders.total).toFixed(2)} € · Pago: {ret.orders.payment_method || '—'}
                                    </td>
                                </tr>
                                <tr><td><strong>Cliente</strong></td><td>{customerName} ({customerEmail})</td></tr>
                                <tr><td><strong>Solicitada</strong></td><td>{ret.requested_at.toLocaleString('es-ES')}</td></tr>
                                {ret.approved_at && <tr><td><strong>Aprobada</strong></td><td>{ret.approved_at.toLocaleString('es-ES')}</td></tr>}
                                {ret.received_at && <tr><td><strong>Recibida</strong></td><td>{ret.received_at.toLocaleString('es-ES')}</td></tr>}
                                {ret.refunded_at && <tr><td><strong>Reembolsada</strong></td><td>{ret.refunded_at.toLocaleString('es-ES')}</td></tr>}
                                {ret.rejected_at && <tr><td><strong>Rechazada</strong></td><td>{ret.rejected_at.toLocaleString('es-ES')}</td></tr>}
                                {ret.tracking_number && <tr><td><strong>Tracking</strong></td><td><code>{ret.tracking_number}</code></td></tr>}
                                {ret.refund_amount && <tr><td><strong>Importe reembolsado</strong></td><td>{Number(ret.refund_amount).toFixed(2)} €</td></tr>}
                                {ret.stripe_refund_id && <tr><td><strong>Stripe refund</strong></td><td><code>{ret.stripe_refund_id}</code></td></tr>}
                            </tbody>
                        </table>
                    </div>

                    <div className="admin-table-container">
                        <div className="admin-table-header">
                            <h2 className="admin-table-title">Productos a devolver</h2>
                        </div>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>SKU</th>
                                    <th style={{ textAlign: 'right' }}>Cant.</th>
                                    <th>Estado</th>
                                    <th style={{ textAlign: 'right' }}>Precio unit.</th>
                                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ret.return_items.map((ri) => (
                                    <tr key={ri.id}>
                                        <td>{ri.order_items.name}</td>
                                        <td><code>{ri.order_items.sku}</code></td>
                                        <td style={{ textAlign: 'right' }}>{ri.quantity}</td>
                                        <td>{CONDITION_LABELS[ri.condition] || ri.condition}</td>
                                        <td style={{ textAlign: 'right' }}>{Number(ri.order_items.price).toFixed(2)} €</td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                            {(Number(ri.order_items.price) * ri.quantity).toFixed(2)} €
                                        </td>
                                    </tr>
                                ))}
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'right', fontWeight: 700 }}>Total productos:</td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                                        {suggestedRefund.toFixed(2)} €
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="admin-table-container" style={{ padding: '1.25rem' }}>
                        <h3 style={{ marginBottom: '0.5rem' }}>Motivo del cliente</h3>
                        <p style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-secondary)' }}>{ret.reason}</p>
                        {ret.admin_notes && (
                            <>
                                <h3 style={{ margin: '1rem 0 0.5rem' }}>Notas internas</h3>
                                <p style={{ whiteSpace: 'pre-wrap', color: 'var(--color-text-secondary)' }}>{ret.admin_notes}</p>
                            </>
                        )}
                    </div>
                </div>

                {/* Columna derecha: acciones */}
                <ReturnManagerForm
                    returnId={ret.id}
                    status={ret.status}
                    suggestedRefund={suggestedRefund}
                    isStripe={isStripe}
                />
            </div>
        </>
    );
}
