'use client';

import { useState } from 'react';
import { updateSettings } from './actions';
import styles from './Settings.module.css';

interface Setting {
    id: string;
    key: string;
    value: string;
    type: string;
}

interface SettingsFormProps {
    initialSettings: Setting[];
}

export default function SettingsForm({ initialSettings }: SettingsFormProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

    // Convert array to map for easy lookup
    const settingsMap = initialSettings.reduce((acc, current) => {
        acc[current.key] = current.value;
        return acc;
    }, {} as Record<string, string>);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage(null);

        const formData = new FormData(e.currentTarget);

        // Handle unchecked checkboxes (FormData doesn't include them)
        const checkBoxes = ['feature_blog_enabled', 'feature_wishlist_enabled', 'feature_reviews_enabled'];
        checkBoxes.forEach(box => {
            if (!formData.has(box)) {
                formData.append(box, 'false');
            } else {
                formData.set(box, 'true'); // If it's "on" (default checkbox value), set to "true"
            }
        });

        try {
            const result = await updateSettings(formData);
            if (result.success) {
                setMessage({ text: result.message || 'Saved', isError: false });
            } else {
                setMessage({ text: result.error || 'Error', isError: true });
            }
        } catch (error: any) {
            setMessage({ text: error.message || 'Error de conexión o configuración del servidor.', isError: true });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="admin-form" style={{ maxWidth: 800 }}>
            {message && (
                <div className={`p-4 mb-6 rounded-md ${message.isError ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* General Information */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2 mb-4 text-[var(--color-text)]">General</h3>

                    <div className="admin-form-group">
                        <label className="admin-form-label">Nombre del sitio</label>
                        <input name="site_name" className="admin-form-input" defaultValue={settingsMap['site_name'] || 'eShop'} />
                    </div>

                    <div className="admin-form-group">
                        <label className="admin-form-label">Email de contacto</label>
                        <input type="email" name="contact_email" className="admin-form-input" defaultValue={settingsMap['contact_email'] || 'contacto@eshop.com'} />
                    </div>

                    <div className="admin-form-group">
                        <label className="admin-form-label">Moneda (ISO)</label>
                        <input name="currency" className="admin-form-input" defaultValue={settingsMap['currency'] || 'EUR'} />
                    </div>
                </div>

                {/* Feature Toggles */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium border-b pb-2 mb-4 text-[var(--color-primary)]">Módulos del Frontend (Feature Flags)</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        Modifica estos interruptores para ocultar o mostrar secciones de forma global.
                    </p>

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-[var(--color-surface)] shadow-sm">
                        <div>
                            <p className="font-medium text-[var(--color-text)]">Blog Activo</p>
                            <p className="text-sm text-[var(--color-text-secondary)]">Muestra el blog a los visitantes.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="feature_blog_enabled" defaultChecked={settingsMap['feature_blog_enabled'] !== 'false'} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--color-primary)]"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-[var(--color-surface)] shadow-sm">
                        <div>
                            <p className="font-medium text-[var(--color-text)]">Lista de Deseos (Favoritos)</p>
                            <p className="text-sm text-[var(--color-text-secondary)]">Permite a los usuarios guardar favoritos.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="feature_wishlist_enabled" defaultChecked={settingsMap['feature_wishlist_enabled'] !== 'false'} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--color-primary)]"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-[var(--color-surface)] shadow-sm">
                        <div>
                            <p className="font-medium text-[var(--color-text)]">Reseñas de Productos</p>
                            <p className="text-sm text-[var(--color-text-secondary)]">Habilita calificar los artículos.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" name="feature_reviews_enabled" defaultChecked={settingsMap['feature_reviews_enabled'] !== 'false'} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--color-primary)]"></div>
                        </label>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t flex justify-end">
                <button
                    type="submit"
                    className="admin-button-primary px-8 py-3 text-lg"
                    disabled={isLoading}
                >
                    {isLoading ? 'Guardando Ajustes...' : 'Guardar Ajustes'}
                </button>
            </div>
        </form>
    );
}
