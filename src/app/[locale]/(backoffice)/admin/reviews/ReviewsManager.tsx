'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from '@/i18n/navigation';
import { approveReview, unapproveReview, deleteReview } from './actions';
import type { AdminReview } from '@/types/admin';

const STATUS_TABS = [
    { value: 'pending', label: 'Pendientes' },
    { value: 'approved', label: 'Aprobadas' },
    { value: 'all', label: 'Todas' }
] as const;

function renderStars(rating: number) {
    return (
        <span style={{ color: '#FFD700', letterSpacing: '1px' }} aria-label={`${rating} de 5 estrellas`}>
            {'★'.repeat(rating)}
            <span style={{ color: 'var(--color-border)' }}>{'★'.repeat(5 - rating)}</span>
        </span>
    );
}

export default function ReviewsManager({
    initialReviews,
    status,
    pendingCount
}: {
    initialReviews: AdminReview[];
    status: 'pending' | 'approved' | 'all';
    pendingCount: number;
}) {
    const router = useRouter();
    const [busyId, setBusyId] = useState<string | null>(null);

    const run = async (id: string, fn: (id: string) => Promise<{ success: boolean; error?: string }>) => {
        setBusyId(id);
        try {
            const result = await fn(id);
            if (!result.success) alert(result.error || 'Ha ocurrido un error.');
            router.refresh();
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar esta reseña permanentemente? Esta acción no se puede deshacer.')) return;
        await run(id, deleteReview);
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>Reseñas de clientes</h1>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {STATUS_TABS.map((tab) => (
                        <Link
                            key={tab.value}
                            href={`/admin/reviews?status=${tab.value}`}
                            className={`btn ${status === tab.value ? 'btn-primary' : 'btn-outline'}`}
                            style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}
                        >
                            {tab.label}
                            {tab.value === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
                        </Link>
                    ))}
                </div>
            </div>

            {initialReviews.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-lg)' }}>
                    <p style={{ color: 'var(--color-text-secondary)' }}>No hay reseñas en esta vista.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {initialReviews.map((review) => {
                        const productName = review.products.product_translations[0]?.name || review.products.slug;
                        const images: string[] = review.images ? JSON.parse(review.images) : [];
                        const isBusy = busyId === review.id;

                        return (
                            <div
                                key={review.id}
                                style={{
                                    padding: '1.5rem',
                                    backgroundColor: 'var(--color-background-soft)',
                                    borderRadius: 'var(--radius-md)',
                                    border: review.is_approved ? '1px solid transparent' : '1px solid var(--color-warning, #d97706)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
                                    <div>
                                        {renderStars(review.rating)}
                                        {review.title && <div style={{ fontWeight: 'bold', marginTop: '0.35rem' }}>{review.title}</div>}
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                                            {productName} · {review.users.name || review.users.email} · {new Date(review.created_at).toLocaleDateString()}
                                            {review.is_verified_purchase && (
                                                <span style={{ marginLeft: '0.5rem', color: 'var(--color-success)', fontWeight: 600 }}>· Compra verificada</span>
                                            )}
                                        </div>
                                    </div>
                                    <span
                                        style={{
                                            alignSelf: 'flex-start',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: 'var(--radius-sm)',
                                            color: 'white',
                                            backgroundColor: review.is_approved ? 'var(--color-success)' : 'var(--color-warning, #d97706)'
                                        }}
                                    >
                                        {review.is_approved ? 'Publicada' : 'Pendiente'}
                                    </span>
                                </div>

                                {review.comment && <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: images.length > 0 ? '1rem' : 0 }}>{review.comment}</p>}

                                {images.length > 0 && (
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                        {images.map((url) => (
                                            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                                <Image src={url} alt="" width={80} height={80} style={{ objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }} />
                                            </a>
                                        ))}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {!review.is_approved ? (
                                        <button className="btn btn-primary" disabled={isBusy} onClick={() => run(review.id, approveReview)}>
                                            Aprobar
                                        </button>
                                    ) : (
                                        <button className="btn btn-outline" disabled={isBusy} onClick={() => run(review.id, unapproveReview)}>
                                            Despublicar
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-outline"
                                        style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                                        disabled={isBusy}
                                        onClick={() => handleDelete(review.id)}
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
