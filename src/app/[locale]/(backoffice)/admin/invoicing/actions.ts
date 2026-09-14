'use server';

import { requireAdmin, AuthorizationError } from '@/lib/auth';
import { verifyInvoiceChain, type ChainVerificationResult } from '@/lib/verifactu';

export async function checkInvoiceChainIntegrity(): Promise<ChainVerificationResult> {
    try {
        await requireAdmin(undefined, 'invoicing.view');
        return await verifyInvoiceChain();
    } catch (error: unknown) {
        const message = error instanceof AuthorizationError ? error.message : 'No se pudo verificar la cadena.';
        return { ok: false, totalRecords: 0, reason: message };
    }
}
