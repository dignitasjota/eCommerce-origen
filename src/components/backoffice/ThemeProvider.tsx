'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>('light');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Run only on client side after hydration
        setMounted(true);
        const storedTheme = localStorage.getItem('admin-theme') as Theme;
        const defaultDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        const initialTheme = storedTheme || (defaultDark ? 'dark' : 'light');
        setTheme(initialTheme);
        document.documentElement.setAttribute('data-admin-theme', initialTheme);
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('admin-theme', newTheme);
        document.documentElement.setAttribute('data-admin-theme', newTheme);
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {!mounted ? (
                <div style={{ visibility: 'hidden' }}>{children}</div>
            ) : (
                children
            )}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
