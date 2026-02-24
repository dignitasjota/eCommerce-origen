'use client';

import { useState } from 'react';
import { updateProductRelations } from './actions';
import { useRouter } from 'next/navigation';

export default function ProductEditForm({ productId, existingRelations, allProducts }: any) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    // Parse existing relations
    const initialCrossSells = existingRelations.filter((r: any) => r.relation_type === 'CROSS_SELL').map((r: any) => r.related_product_id);
    const initialUpSells = existingRelations.filter((r: any) => r.relation_type === 'UP_SELL').map((r: any) => r.related_product_id);

    const [crossSells, setCrossSells] = useState<string[]>(initialCrossSells);
    const [upSells, setUpSells] = useState<string[]>(initialUpSells);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        const result = await updateProductRelations(productId, crossSells, upSells);
        setIsLoading(false);
        if (result.success) {
            alert('Relaciones actualizadas exitosamente');
            router.refresh();
        } else {
            alert(result.error);
        }
    };

    const handleSelectMultiple = (e: React.ChangeEvent<HTMLSelectElement>, setter: Function) => {
        const options = Array.from(e.target.selectedOptions, option => option.value);
        setter(options);
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            <div style={{ backgroundColor: 'var(--color-background)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Ventas Cruzadas (Cross-Selling)</label>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>Selecciona productos accesorios, consumibles o complementarios que el usuario tienda a comprar junto con este artículo ("Frecuentemente comprados juntos").</p>
                <select multiple value={crossSells} onChange={(e) => handleSelectMultiple(e, setCrossSells)} style={{ width: '100%', minHeight: '200px', padding: '1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'inherit', fontSize: '1rem' }} className="admin-input form-input">
                    {allProducts.map((p: any) => (
                        <option key={p.id} value={p.id} style={{ padding: '0.5rem', cursor: 'pointer' }}>{p.name} ({p.sku})</option>
                    ))}
                </select>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', marginTop: '0.5rem' }}>* Mantén presionado Cmd (Mac) o Ctrl (Windows) para seleccionar múltiples productos.</p>
            </div>

            <div style={{ backgroundColor: 'var(--color-background)', padding: '1.5rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                <label style={{ display: 'block', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Opción Premium (Up-Selling)</label>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>Selecciona productos superiores, modelos más recientes o de calidad premium para sugerirlos como alternativa principal ("Quizás te interese esto en su lugar").</p>
                <select multiple value={upSells} onChange={(e) => handleSelectMultiple(e, setUpSells)} style={{ width: '100%', minHeight: '200px', padding: '1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontFamily: 'inherit', fontSize: '1rem' }} className="admin-input form-input">
                    {allProducts.map((p: any) => (
                        <option key={p.id} value={p.id} style={{ padding: '0.5rem', cursor: 'pointer' }}>{p.name} ({p.sku})</option>
                    ))}
                </select>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)', marginTop: '0.5rem' }}>* Mantén presionado Cmd (Mac) o Ctrl (Windows) para seleccionar múltiples productos.</p>
            </div>

            <div style={{ alignSelf: 'flex-start' }}>
                <button type="submit" disabled={isLoading} className="admin-btn admin-btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}>
                    {isLoading ? 'Guardando Relaciones...' : 'Guardar y Sincronizar'}
                </button>
            </div>
        </form>
    );
}
