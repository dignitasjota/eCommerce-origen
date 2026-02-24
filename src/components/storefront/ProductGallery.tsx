'use client';

import { useState } from 'react';

interface ProductGalleryProps {
    images: string[];
    productName: string;
}

export default function ProductGallery({ images, productName }: ProductGalleryProps) {
    const [activeIndex, setActiveIndex] = useState(0);

    const hasImages = images && images.length > 0;
    const mainImage = hasImages ? images[activeIndex] : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Main Image */}
            <div
                style={{
                    aspectRatio: '1 / 1',
                    backgroundColor: 'var(--color-background-soft)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {mainImage ? (
                    <img
                        src={mainImage}
                        alt={productName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.2">
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                )}
            </div>

            {/* Thumbnails */}
            {hasImages && images.length > 1 && (
                <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    {images.map((img, index) => (
                        <button
                            key={index}
                            onClick={() => setActiveIndex(index)}
                            style={{
                                width: '80px',
                                height: '80px',
                                flexShrink: 0,
                                borderRadius: 'var(--radius-md)',
                                overflow: 'hidden',
                                border: activeIndex === index ? '2px solid var(--color-primary)' : '2px solid transparent',
                                cursor: 'pointer',
                                padding: 0,
                                backgroundColor: 'var(--color-background-soft)'
                            }}
                        >
                            <img src={img} alt={`Thumbnail ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
