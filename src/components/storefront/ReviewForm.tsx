'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReviewForm({ productId }: { productId: string }) {
    const [rating, setRating] = useState(5);
    const [title, setTitle] = useState('');
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/storefront/reviews', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, rating, title, comment })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error al enviar la reseña');
            }

            setSuccess(true);
            router.refresh();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (success) {
        return (
            <div style={{ padding: '2rem', backgroundColor: 'var(--color-background-soft)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 1rem' }}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>¡Gracias por tu reseña!</h3>
                <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.5rem' }}>Tu opinión ha sido enviada y está pendiente de moderación.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} style={{ padding: '2rem', backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Escribe una reseña</h3>

            {error && (
                <div style={{ padding: '1rem', backgroundColor: 'var(--color-danger-soft)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
                    {error}
                </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Puntuación</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                            <svg width="32" height="32" viewBox="0 0 24 24" fill={rating >= star ? '#FFD700' : 'none'} stroke={rating >= star ? '#FFD700' : 'var(--color-text-tertiary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="title" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Título de la reseña</label>
                <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="input"
                    placeholder="Resume tu experiencia..."
                    required
                />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="comment" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Comentario (Opcional)</label>
                <textarea
                    id="comment"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    className="input"
                    placeholder="¿Qué te ha parecido el producto?"
                    rows={4}
                />
            </div>

            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Enviando...' : 'Enviar Reseña'}
            </button>
        </form>
    );
}
