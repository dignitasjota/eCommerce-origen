'use client';

import { useState } from 'react';
import { checkInvoiceChainIntegrity } from './actions';

/**
 * Recalcula la huella de cada `InvoiceRecord` en orden y confirma que
 * encadena correctamente con el anterior — cualquier alteración retroactiva
 * de un registro (o del puntero de cadena) rompe la verificación a partir de
 * ese punto. Ver `verifyInvoiceChain` en src/lib/verifactu.ts.
 */
export default function VerifyChainButton() {
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<Awaited<ReturnType<typeof checkInvoiceChainIntegrity>> | null>(null);

    const run = async () => {
        setBusy(true);
        setResult(null);
        const r = await checkInvoiceChainIntegrity();
        setResult(r);
        setBusy(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
            <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={run} disabled={busy}>
                {busy ? 'Verificando…' : 'Verificar integridad de la cadena'}
            </button>
            {result && (
                <p style={{ fontSize: '0.85rem', margin: 0, color: result.ok ? 'var(--color-success, green)' : 'var(--color-danger)' }}>
                    {result.ok
                        ? `✓ Cadena íntegra — ${result.totalRecords} registro(s) verificados.`
                        : `✗ Cadena rota${result.brokenAtInvoiceNumber ? ` en ${result.brokenAtInvoiceNumber}` : ''}: ${result.reason}`}
                </p>
            )}
        </div>
    );
}
