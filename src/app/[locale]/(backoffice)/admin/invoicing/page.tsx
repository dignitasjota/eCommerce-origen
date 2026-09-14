import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/db';
import { hasPermission } from '@/lib/auth';
import CursorPagination from '@/components/backoffice/CursorPagination';
import { parseCursorParams, buildCursorWhere, buildCursorPage, CURSOR_ORDER_BY } from '@/lib/pagination';
import VerifyChainButton from './VerifyChainButton';

export const dynamic = 'force-dynamic';

type Props = {
    params: Promise<{ locale: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * Visor de la base local de cumplimiento Veri*Factu — el "registro de
 * facturación" encadenado que genera `src/lib/verifactu.ts` cada vez que se
 * asigna un `invoice_number`. Cursor pagination porque crece 1:1 con las
 * facturas (mismo criterio que `/admin/audit-logs`).
 *
 * Esto NO es un panel de una integración certificada: no hay nada que
 * "reenviar" a la AEAT desde aquí todavía — ver el aviso fijo en la cabecera.
 */
export default async function InvoicingPage({ params, searchParams }: Props) {
    if (!(await hasPermission('invoicing.view'))) notFound();

    const { locale } = await params;
    const sp = await searchParams;

    const cursorParams = parseCursorParams(sp);
    const currentCursor = typeof sp.cursor === 'string' ? sp.cursor : undefined;

    const cursorWhere = buildCursorWhere(cursorParams.cursor);
    const rows = await prisma.invoiceRecord.findMany({
        where: cursorWhere,
        orderBy: CURSOR_ORDER_BY,
        take: cursorParams.take + 1,
        include: { orders: { select: { order_number: true } } }
    });
    const { items: records, nextCursor } = buildCursorPage(rows, cursorParams.take);

    const basePath = locale === 'es' ? '/admin/invoicing' : `/${locale}/admin/invoicing`;
    const totalRecords = await prisma.invoiceRecord.count();

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Facturación (Veri*Factu)</h1>
                <div className="admin-topbar-actions">
                    <Link href="/api/admin/invoicing/export" className="admin-btn admin-btn-secondary" target="_blank">
                        Exportar CSV
                    </Link>
                </div>
            </div>

            <div className="admin-page">
                <div className="admin-card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--color-warning, orange)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.5 }}>
                        <strong>Base local, no certificada.</strong> Cada factura genera aquí un registro encadenado
                        (huella SHA-256 + QR) que demuestra que no se ha alterado retroactivamente, pero{' '}
                        <strong>no hay firma electrónica con certificado real ni envío a la AEAT</strong> — el estado
                        de envío se queda en <code>PENDING</code> hasta conectar un proveedor homologado (Sage,
                        Holded, B2Brouter…) o el webservice oficial. Revisa el algoritmo de huella/QR contra la
                        especificación técnica vigente de la AEAT antes de considerar esto conforme.
                    </p>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <VerifyChainButton />
                </div>

                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">{totalRecords} registro(s)</h2>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Nº factura</th>
                                <th>Pedido</th>
                                <th>Tipo</th>
                                <th style={{ textAlign: 'right' }}>Base</th>
                                <th style={{ textAlign: 'right' }}>IVA</th>
                                <th style={{ textAlign: 'right' }}>Total</th>
                                <th>Envío</th>
                                <th>Huella</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((r) => (
                                <tr key={r.id}>
                                    <td className="text-xs">
                                        {new Date(r.issued_at).toLocaleString('es-ES', {
                                            day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </td>
                                    <td><code>{r.invoice_number}</code></td>
                                    <td className="text-xs">
                                        <Link href={`/admin/orders/${r.order_id}`}>{r.orders.order_number}</Link>
                                    </td>
                                    <td>{r.invoice_type}</td>
                                    <td style={{ textAlign: 'right' }}>{Number(r.taxable_base).toFixed(2)} €</td>
                                    <td style={{ textAlign: 'right' }}>{Number(r.vat_amount).toFixed(2)} € ({Number(r.vat_rate)}%)</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(r.total_amount).toFixed(2)} €</td>
                                    <td>
                                        <span className={`admin-badge ${r.submission_status === 'SUBMITTED' ? 'active' : 'inactive'}`}>
                                            {r.submission_status}
                                        </span>
                                    </td>
                                    <td className="text-xs">
                                        <span title={r.hash}><code>{r.hash.slice(0, 10)}…</code></span>
                                    </td>
                                </tr>
                            ))}
                            {records.length === 0 && (
                                <tr>
                                    <td colSpan={9}>
                                        <div className="admin-empty">
                                            <h3>Sin registros todavía</h3>
                                            <p>Se generan automáticamente al confirmarse el pago de un pedido (necesita el CIF del vendedor configurado en Ajustes → Pagos).</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <CursorPagination basePath={basePath} currentCursor={currentCursor} nextCursor={nextCursor} extraParams={{}} />
            </div>
        </>
    );
}
