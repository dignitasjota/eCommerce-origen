'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { MAX_COMPARE_ITEMS } from '@/lib/compare';

export interface CompareItem {
    id: string;
    slug: string;
    name: string;
    price: string;
    image?: string;
}

export { MAX_COMPARE_ITEMS };

const STORAGE_KEY = 'eshop_compare';

interface CompareContextProps {
    items: CompareItem[];
    isInCompare: (id: string) => boolean;
    toggleCompare: (item: CompareItem) => { added: boolean; reason?: 'limit' };
    removeFromCompare: (id: string) => void;
    clearCompare: () => void;
}

const CompareContext = createContext<CompareContextProps | undefined>(undefined);

export const CompareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<CompareItem[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);

    // Hidratar desde localStorage sólo en cliente (evita mismatch SSR).
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) setItems(parsed);
            }
        } catch {
            // localStorage no disponible o corrupto — arrancamos vacío.
        } finally {
            setIsInitialized(true);
        }
    }, []);

    useEffect(() => {
        if (!isInitialized) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch {
            // Storage lleno o bloqueado — el comparador sigue funcionando en memoria.
        }
    }, [items, isInitialized]);

    const isInCompare = (id: string) => items.some((i) => i.id === id);

    const toggleCompare = (item: CompareItem): { added: boolean; reason?: 'limit' } => {
        if (isInCompare(item.id)) {
            setItems((prev) => prev.filter((i) => i.id !== item.id));
            return { added: false };
        }
        if (items.length >= MAX_COMPARE_ITEMS) {
            return { added: false, reason: 'limit' };
        }
        setItems((prev) => [...prev, item]);
        return { added: true };
    };

    const removeFromCompare = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
    const clearCompare = () => setItems([]);

    return (
        <CompareContext.Provider value={{ items, isInCompare, toggleCompare, removeFromCompare, clearCompare }}>
            {children}
        </CompareContext.Provider>
    );
};

export const useCompare = () => {
    const context = useContext(CompareContext);
    if (!context) {
        throw new Error('useCompare debe ser usado dentro de un CompareProvider');
    }
    return context;
};
