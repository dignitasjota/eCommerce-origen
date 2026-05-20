import PDFDocument from 'pdfkit';
import { Buffer } from 'node:buffer';

interface InvoiceItem {
    name: string;
    sku: string;
    quantity: number;
    price: number; // unitario
}

interface InvoiceAddress {
    first_name: string;
    last_name: string;
    company?: string | null;
    address1: string;
    address2?: string | null;
    city: string;
    state?: string | null;
    postal_code: string;
    country: string;
    phone?: string | null;
    tax_id?: string | null;
}

export interface InvoiceData {
    invoice_number: string;
    order_number: string;
    issued_at: Date;
    customer: {
        name: string;
        email: string;
    };
    billing_address: InvoiceAddress | null;
    items: InvoiceItem[];
    subtotal: number;
    shipping_cost: number;
    discount: number;
    tax: number;
    total: number;
    seller: {
        name: string;
        tax_id?: string;
        address?: string;
        email?: string;
    };
}

const eur = (n: number) => `${n.toFixed(2)} €`;

/**
 * Genera el PDF de la factura como Buffer Node.
 *
 * Diseño deliberadamente simple (no logos, fuentes built-in de pdfkit) para
 * que sea predecible en cualquier sistema. Si se necesita branding del
 * cliente, leer logo/colores desde SiteSettings y pasarlos en `seller`.
 *
 * No incluye sellos electrónicos ni firma digital. Para cumplimiento
 * fiscal estricto (Veri*Factu en España, p.ej.), enviar a un servicio
 * externo de facturación electrónica.
 */
export async function buildInvoicePdf(data: InvoiceData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            const chunks: Buffer[] = [];
            doc.on('data', (c) => chunks.push(c as Buffer));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // ─── Cabecera ───────────────────────────────────────────────
            doc.fontSize(20).font('Helvetica-Bold').text('FACTURA', { align: 'right' });
            doc.fontSize(10).font('Helvetica');
            doc.text(`Nº: ${data.invoice_number}`, { align: 'right' });
            doc.text(`Pedido: ${data.order_number}`, { align: 'right' });
            doc.text(
                `Fecha: ${data.issued_at.toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                })}`,
                { align: 'right' }
            );

            doc.moveDown(1);

            // ─── Vendedor (izquierda) ───────────────────────────────────
            const sellerY = doc.y;
            doc.font('Helvetica-Bold').text(data.seller.name);
            doc.font('Helvetica').fontSize(9);
            if (data.seller.tax_id) doc.text(`CIF: ${data.seller.tax_id}`);
            if (data.seller.address) doc.text(data.seller.address);
            if (data.seller.email) doc.text(data.seller.email);

            // ─── Comprador (derecha, misma altura) ──────────────────────
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Cliente:', 320, sellerY);
            doc.font('Helvetica').fontSize(9);
            doc.text(data.customer.name, 320);
            doc.text(data.customer.email, 320);
            if (data.billing_address) {
                const a = data.billing_address;
                doc.text(`${a.first_name} ${a.last_name}`, 320);
                if (a.company) doc.text(a.company, 320);
                doc.text(a.address1, 320);
                if (a.address2) doc.text(a.address2, 320);
                doc.text(`${a.postal_code} ${a.city}${a.state ? `, ${a.state}` : ''}`, 320);
                doc.text(a.country, 320);
                if (a.tax_id) doc.text(`NIF/CIF: ${a.tax_id}`, 320);
            }

            doc.moveDown(2);

            // ─── Tabla de items ─────────────────────────────────────────
            const tableTop = doc.y + 10;
            const colX = { name: 40, sku: 280, qty: 380, price: 430, total: 510 };

            doc.font('Helvetica-Bold').fontSize(9);
            doc.text('Concepto', colX.name, tableTop);
            doc.text('SKU', colX.sku, tableTop);
            doc.text('Cant.', colX.qty, tableTop, { width: 40, align: 'right' });
            doc.text('Precio', colX.price, tableTop, { width: 70, align: 'right' });
            doc.text('Total', colX.total, tableTop, { width: 50, align: 'right' });

            doc.moveTo(40, tableTop + 14)
                .lineTo(560, tableTop + 14)
                .strokeColor('#cccccc')
                .stroke();

            doc.font('Helvetica').fontSize(9);
            let y = tableTop + 22;
            for (const item of data.items) {
                doc.text(item.name, colX.name, y, { width: 235 });
                doc.text(item.sku, colX.sku, y, { width: 95 });
                doc.text(String(item.quantity), colX.qty, y, { width: 40, align: 'right' });
                doc.text(eur(item.price), colX.price, y, { width: 70, align: 'right' });
                doc.text(eur(item.price * item.quantity), colX.total, y, { width: 50, align: 'right' });
                y += 18;
            }

            // ─── Totales ────────────────────────────────────────────────
            y += 10;
            doc.moveTo(380, y).lineTo(560, y).strokeColor('#cccccc').stroke();
            y += 8;

            const totalLine = (label: string, value: number, bold = false) => {
                doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9);
                doc.text(label, 380, y, { width: 100, align: 'right' });
                doc.text(eur(value), 510, y, { width: 50, align: 'right' });
                y += bold ? 18 : 14;
            };

            totalLine('Subtotal:', data.subtotal);
            if (data.discount > 0) totalLine('Descuento:', -data.discount);
            totalLine('Envío:', data.shipping_cost);
            if (data.tax > 0) totalLine('Impuestos:', data.tax);
            doc.moveTo(380, y).lineTo(560, y).strokeColor('#cccccc').stroke();
            y += 6;
            totalLine('TOTAL:', data.total, true);

            // ─── Pie ────────────────────────────────────────────────────
            doc.font('Helvetica').fontSize(8).fillColor('#777777');
            doc.text(
                `Documento generado automáticamente. Sin valor fiscal hasta ser firmado o conservado según la normativa aplicable.`,
                40,
                760,
                { align: 'center', width: 520 }
            );

            doc.end();
        } catch (e) {
            reject(e);
        }
    });
}
