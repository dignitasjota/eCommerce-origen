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

    const [activeTab, setActiveTab] = useState('general');

    // Add logic for current carousel images
    const [carouselImages, setCarouselImages] = useState<string[]>(() => {
        try {
            return settingsMap['home_carousel_images'] ? JSON.parse(settingsMap['home_carousel_images']) : [];
        } catch (e) {
            return [];
        }
    });

    const handleRemoveCarouselImage = (indexToRemove: number) => {
        setCarouselImages(prev => prev.filter((_, i) => i !== indexToRemove));
    };

    return (
        <form onSubmit={handleSubmit} className="admin-form" style={{ maxWidth: 800 }}>
            {message && (
                <div className={`p-4 mb-6 rounded-md ${message.isError ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                    {message.text}
                </div>
            )}

            <div role="tablist" className="tabs tabs-lift tabs-lg mb-8 w-full max-w-full overflow-x-auto overflow-y-hidden">
                {/* --- TAB GLOBAL --- */}
                <input
                    type="radio"
                    name="settings_tabs"
                    role="tab"
                    className="tab font-semibold"
                    style={{ whiteSpace: 'pre', minWidth: 'max-content', padding: '0 2rem' }}
                    aria-label="  Configuración Global  "
                    checked={activeTab === 'general'}
                    onChange={() => setActiveTab('general')}
                />
                <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6 shadow-sm overflow-hidden">
                    {activeTab === 'general' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="border-b pb-2 mb-4">
                                <h3 className="text-lg font-medium text-[var(--color-primary)]">Identidad y Base</h3>
                                <p className="text-sm text-gray-500 mt-1">Ajustes básicos que definen tu tienda.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Logotipo del Backoffice / Sitio</label>
                                    {settingsMap['site_logo'] && (
                                        <div className="mb-2 p-2 bg-gray-100 rounded-md inline-block">
                                            <img src={settingsMap['site_logo']} alt="Logo" style={{ maxHeight: '40px', objectFit: 'contain' }} />
                                        </div>
                                    )}
                                    <input type="file" name="site_logo" accept="image/*" className="admin-form-input p-2" />
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Favicon (Icono de pestaña)</label>
                                    {settingsMap['site_favicon'] && (
                                        <div className="mb-2 p-2 bg-gray-100 rounded-md inline-block">
                                            <img src={settingsMap['site_favicon']} alt="Favicon" style={{ maxHeight: '32px', objectFit: 'contain' }} />
                                        </div>
                                    )}
                                    <input type="file" name="site_favicon" accept="image/x-icon,image/png,image/jpeg,image/svg+xml" className="admin-form-input p-2" />
                                    <p className="text-xs text-gray-500 mt-1">Se recomienda formato cuadrado (.png, .ico, .svg).</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- TAB MÓDULOS --- */}
                <input
                    type="radio"
                    name="settings_tabs"
                    role="tab"
                    className="tab font-semibold"
                    style={{ whiteSpace: 'pre', minWidth: 'max-content', padding: '0 2rem' }}
                    aria-label="  Módulos Frontend  "
                    checked={activeTab === 'modules'}
                    onChange={() => setActiveTab('modules')}
                />
                <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6 shadow-sm overflow-hidden">
                    {activeTab === 'modules' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="border-b pb-2 mb-4">
                                <h3 className="text-lg font-medium text-[var(--color-primary)]">Módulos del Frontend</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Activa o desactiva funcionalidades completas en la tienda pública.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Feature: Blog */}
                                <div className="flex flex-col p-5 border rounded-xl bg-[var(--color-surface)] shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg dark:bg-indigo-900/30 dark:text-indigo-400">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" name="feature_blog_enabled" defaultChecked={settingsMap['feature_blog_enabled'] !== 'false'} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--color-primary)]"></div>
                                        </label>
                                    </div>
                                    <h4 className="font-semibold text-[var(--color-text)] mb-1">Blog de Noticias</h4>
                                    <p className="text-sm text-[var(--color-text-secondary)]">Publica artículos y novedades para tus visitantes y mejora tu SEO.</p>
                                </div>

                                {/* Feature: Wishlist */}
                                <div className="flex flex-col p-5 border rounded-xl bg-[var(--color-surface)] shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg dark:bg-rose-900/30 dark:text-rose-400">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" name="feature_wishlist_enabled" defaultChecked={settingsMap['feature_wishlist_enabled'] !== 'false'} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--color-primary)]"></div>
                                        </label>
                                    </div>
                                    <h4 className="font-semibold text-[var(--color-text)] mb-1">Listas de Deseos</h4>
                                    <p className="text-sm text-[var(--color-text-secondary)]">Permite a los usuarios guardar sus productos favoritos para más tarde.</p>
                                </div>

                                {/* Feature: Reviews */}
                                <div className="flex flex-col p-5 border rounded-xl bg-[var(--color-surface)] shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg dark:bg-amber-900/30 dark:text-amber-400">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" name="feature_reviews_enabled" defaultChecked={settingsMap['feature_reviews_enabled'] !== 'false'} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--color-primary)]"></div>
                                        </label>
                                    </div>
                                    <h4 className="font-semibold text-[var(--color-text)] mb-1">Reseñas de Productos</h4>
                                    <p className="text-sm text-[var(--color-text-secondary)]">Habilita a los compradores valorar y comentar en los artículos.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- TAB CARRUSEL --- */}
                <input
                    type="radio"
                    name="settings_tabs"
                    role="tab"
                    className="tab font-semibold"
                    style={{ whiteSpace: 'pre', minWidth: 'max-content', padding: '0 2rem' }}
                    aria-label="  Carrusel Inicio  "
                    checked={activeTab === 'carousel'}
                    onChange={() => setActiveTab('carousel')}
                />
                <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6 shadow-sm overflow-hidden">
                    {activeTab === 'carousel' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="border-b pb-2 mb-4">
                                <h3 className="text-lg font-medium text-[var(--color-primary)]">Carrusel de la Página Principal</h3>
                                <p className="text-sm text-gray-500 mt-1">Sube las imágenes que aparecerán destacadas al entrar a la tienda y define su velocidad.</p>
                            </div>

                            <input type="hidden" name="carousel_images_current" value={JSON.stringify(carouselImages)} />

                            <div className="admin-form-group">
                                <label className="admin-form-label">Añadir nuevas imágenes</label>
                                <input type="file" name="carousel_images_new" accept="image/*" multiple className="admin-form-input p-2" />
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Intervalo de pase (en milisegundos)</label>
                                <input type="number" name="home_carousel_interval" className="admin-form-input" defaultValue={settingsMap['home_carousel_interval'] || '5000'} min="1000" step="500" />
                                <p className="text-xs text-gray-500 mt-1">Ejemplo: 5000 = 5 segundos. Por debajo de 1000 no se recomienda.</p>
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Imágenes Actuales ({carouselImages.length})</label>
                                {carouselImages.length === 0 ? (
                                    <p className="text-sm text-gray-500">No hay imágenes configuradas.</p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                                        {carouselImages.map((src, idx) => (
                                            <div key={idx} className="relative aspect-video bg-gray-100 rounded-md overflow-hidden border">
                                                <img src={src} alt="Carrusel" className="w-full h-full object-cover" />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCarouselImage(idx)}
                                                    className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700 transition"
                                                    title="Eliminar"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                        <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* --- TAB SEO --- */}
                <input
                    type="radio"
                    name="settings_tabs"
                    role="tab"
                    className="tab font-semibold"
                    style={{ whiteSpace: 'pre', minWidth: 'max-content', padding: '0 2rem' }}
                    aria-label="  SEO  "
                    checked={activeTab === 'seo'}
                    onChange={() => setActiveTab('seo')}
                />
                <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6 shadow-sm overflow-hidden">
                    {activeTab === 'seo' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="border-b pb-2 mb-4">
                                <h3 className="text-lg font-medium text-[var(--color-primary)]">Metadatos Globales</h3>
                                <p className="text-sm text-gray-500 mt-1">Configura cómo aparece tu tienda en Google y redes sociales.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Title (Título por defecto)</label>
                                    <input name="seo_default_title" className="admin-form-input" defaultValue={settingsMap['seo_default_title'] || 'eShop - La mejor tienda de ropa online'} placeholder="eShop - La mejor tienda" />
                                    <p className="text-xs text-gray-500 mt-1">Este título aparecerá en las páginas que no tengan un título específico.</p>
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Twitter Handle (@usuario)</label>
                                    <input name="seo_twitter_handle" className="admin-form-input" defaultValue={settingsMap['seo_twitter_handle'] || '@eshop'} placeholder="@tutienda" />
                                    <p className="text-xs text-gray-500 mt-1">Tu cuenta para enlazarse en las Twitter Cards al compartir productos.</p>
                                </div>

                                <div className="admin-form-group md:col-span-2">
                                    <label className="admin-form-label">Meta Description Global</label>
                                    <textarea name="seo_default_description" className="admin-form-input" rows={3} defaultValue={settingsMap['seo_default_description'] || 'Descubre nuestra increíble colección de productos al mejor precio.'} placeholder="Escribe aquí un resumen atractivo para Google (máximo 160 caracteres)." />
                                    <p className="text-xs text-gray-500 mt-1">Aparece bajo el título en los resultados de búsqueda de Google.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Botón Flotante / Fijo abajo para guardar sea cual sea la pestaña */}
            <div className="mt-8 pt-6 border-t flex justify-end sticky bottom-0 bg-white/90 backdrop-blur pb-4">
                <button
                    type="submit"
                    className="admin-btn admin-btn-primary px-8 py-3 text-lg shadow-lg hover:shadow-xl transition-shadow"
                    disabled={isLoading}
                >
                    {isLoading ? 'Guardando Ajustes...' : 'Guardar Ajustes'}
                </button>
            </div>

            {/* Animación local sencilla para la transición de pestañas */}
            <style jsx>{`
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-in-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </form >
    );
}
