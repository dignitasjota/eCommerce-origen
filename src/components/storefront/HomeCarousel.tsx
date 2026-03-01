'use client';

import { useState, useEffect } from 'react';
import { Link } from '@/i18n/navigation';
import styles from '@/app/[locale]/(storefront)/page.module.css';

interface HomeCarouselProps {
    images: string[];
    interval: number;
    texts: {
        newArrivals: string;
        heroTitle: string;
        heroSubtitle: string;
        heroButton: string;
    };
}

export default function HomeCarousel({ images, interval, texts }: HomeCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (!images || images.length <= 1) return;

        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
        }, interval);

        return () => clearInterval(timer);
    }, [images, interval]);

    // If no images are configured, we show the default background through CSS classes just like before
    // If there is only one image, we show it statically.
    // If multiple images, we show the active one.

    const hasImages = images && images.length > 0;

    return (
        <section className={`hero-section ${styles.hero}`} style={hasImages ? { backgroundImage: 'none' } : {}}>
            {hasImages && (
                <div
                    className="absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-1000 ease-in-out"
                    style={{
                        backgroundImage: `url(${images[currentIndex]})`,
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -2
                    }}
                />
            )}

            <div className={styles.heroOverlay} style={hasImages ? { zIndex: -1 } : {}} />

            <div className={`container ${styles.heroContent}`}>
                <span className={styles.heroBadge}>✨ {texts.newArrivals}</span>
                <h1 className={styles.heroTitle}>{texts.heroTitle}</h1>
                <p className={styles.heroSubtitle}>{texts.heroSubtitle}</p>
                <div className={styles.heroActions}>
                    <Link href="/products" className="btn btn-primary btn-lg">
                        {texts.heroButton}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px' }}>
                            <path d="M5 12h14" />
                            <path d="m12 5 7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            </div>

            {hasImages && images.length > 1 && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10" style={{ position: 'absolute', bottom: '2rem', display: 'flex', gap: '8px', zIndex: 10 }}>
                    {images.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setCurrentIndex(i)}
                            className={`w-3 h-3 rounded-full transition-colors ${i === currentIndex ? 'bg-white' : 'bg-white/50'}`}
                            style={{
                                width: '12px', height: '12px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                                backgroundColor: i === currentIndex ? 'white' : 'rgba(255,255,255,0.5)'
                            }}
                            aria-label={`Ir a la imagen ${i + 1}`}
                        />
                    ))}
                </div>
            )}

            {/* Decorative elements */}
            <div className={styles.heroDecor1} />
            <div className={styles.heroDecor2} />
        </section>
    );
}
