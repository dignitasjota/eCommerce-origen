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
    customThemes?: string[];
}

export default function SettingsForm({ initialSettings, customThemes = [] }: SettingsFormProps) {
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
        const checkBoxes = ['feature_blog_enabled', 'feature_wishlist_enabled', 'feature_reviews_enabled', 'feature_contact_enabled'];
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

    interface MenuItem {
        id: string;
        label: string;
        type: 'link' | 'categories';
        url?: string;
        showAllCategories?: boolean;
    }

    const defaultMenu: MenuItem[] = [
        { id: '1', label: 'Inicio', type: 'link', url: '/' },
        { id: '2', label: 'Tienda', type: 'categories' },
        { id: '3', label: 'Catálogo', type: 'link', url: '/products' },
        { id: '4', label: 'Blog', type: 'link', url: '/blog' }
    ];

    const [menuItems, setMenuItems] = useState<MenuItem[]>(() => {
        try {
            return settingsMap['main_menu'] ? JSON.parse(settingsMap['main_menu']) : defaultMenu;
        } catch (e) {
            return defaultMenu;
        }
    });

    const addMenuItem = (type: 'link' | 'categories') => {
        setMenuItems(prev => [...prev, { id: Date.now().toString(), label: type === 'categories' ? 'Tienda' : 'Nuevo Enlace', type, url: type === 'link' ? '/' : undefined, showAllCategories: false }]);
    };

    const removeMenuItem = (id: string) => {
        setMenuItems(prev => prev.filter(item => item.id !== id));
    };

    const updateMenuItem = (id: string, field: keyof MenuItem, value: any) => {
        setMenuItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const moveMenuItem = (index: number, direction: 'up' | 'down') => {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === menuItems.length - 1)) return;
        setMenuItems(prev => {
            const newItems = [...prev];
            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
            return newItems;
        });
    };

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
        <form onSubmit={handleSubmit} className="w-full max-w-5xl">
            {message && (
                <div className={`p-4 mb-6 rounded-md ${message.isError ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                    {message.text}
                </div>
            )}

            <div role="tablist" className="tabs tabs-bordered tabs-lg w-full mb-8">
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
                <div role="tabpanel" className="tab-content admin-table-container !p-6 w-full max-w-none">
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
                                    <label className="admin-form-label">Tema de Diseño Frontend</label>
                                    <select name="storefront_theme" className="admin-form-input" defaultValue={settingsMap['storefront_theme'] || 'default'}>
                                        <option value="default">Por Defecto (Navy & Rosa) - Base</option>
                                        <option value="elegant-dark">Elegante (Oscuro y Dorado)</option>
                                        <option value="eco-nature">Naturaleza & Eco (Verde y Salmón)</option>
                                        <option value="vibrant-tech">Neón & Tecnología (Violeta y Cyan)</option>
                                        <option value="pastel-breeze">Brisa Pastel (Mint y Melocotón)</option>
                                        {customThemes.length > 0 && <optgroup label="Temas Personalizados" />}
                                        {customThemes.map(theme => (
                                            <option key={theme} value={theme}>
                                                Personalizado: {theme}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">El sitio público adaptará la paleta de colores según esta selección para vender distintos estilos.</p>
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Subir Nuevo Tema (.css)</label>
                                    <input type="file" name="theme_file" accept=".css" className="admin-form-input p-2" />
                                    <p className="text-xs text-gray-500 mt-1">Sube un archivo .css para usarlo en la tienda. Al guardarlo aparecerá en el desplegable de Temas de Diseño.</p>
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Logotipo del Backoffice / Sitio</label>
                                    {settingsMap['site_logo'] && (
                                        <div className="mb-2 p-2 admin-table-container rounded-md inline-block">
                                            <img src={settingsMap['site_logo']} alt="Logo" style={{ maxHeight: '40px', objectFit: 'contain' }} />
                                        </div>
                                    )}
                                    <input type="file" name="site_logo" accept="image/*" className="admin-form-input p-2" />
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Favicon (Icono de pestaña)</label>
                                    {settingsMap['site_favicon'] && (
                                        <div className="mb-2 p-2 admin-table-container rounded-md inline-block">
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
                <div role="tabpanel" className="tab-content admin-table-container !p-6 w-full max-w-none">
                    {activeTab === 'modules' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="border-b pb-2 mb-4">
                                <h3 className="text-lg font-medium text-[var(--color-primary)]">Módulos del Frontend</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Activa o desactiva funcionalidades completas en la tienda pública.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Feature: Blog */}
                                <div className="flex flex-col p-5 admin-table-container !rounded-xl !border-[var(--color-border)] hover:shadow-md transition-shadow relative overflow-hidden">
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
                                <div className="flex flex-col p-5 admin-table-container !rounded-xl !border-[var(--color-border)] hover:shadow-md transition-shadow relative overflow-hidden">
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
                                <div className="flex flex-col p-5 admin-table-container !rounded-xl !border-[var(--color-border)] hover:shadow-md transition-shadow relative overflow-hidden">
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

                                {/* Feature: Contact */}
                                <div className="flex flex-col p-5 admin-table-container !rounded-xl !border-[var(--color-border)] hover:shadow-md transition-shadow relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg dark:bg-emerald-900/30 dark:text-emerald-400">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" name="feature_contact_enabled" defaultChecked={settingsMap['feature_contact_enabled'] !== 'false'} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[var(--color-primary)]"></div>
                                        </label>
                                    </div>
                                    <h4 className="font-semibold text-[var(--color-text)] mb-1">Formulario de Contacto</h4>
                                    <p className="text-sm text-[var(--color-text-secondary)]">Página de contacto (/contact) para que los clientes puedan escribirte consultas y dudas.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- TAB MENÚ --- */}
                <input
                    type="radio"
                    name="settings_tabs"
                    role="tab"
                    className="tab font-semibold"
                    style={{ whiteSpace: 'pre', minWidth: 'max-content', padding: '0 2rem' }}
                    aria-label="  Menú Principal  "
                    checked={activeTab === 'menu'}
                    onChange={() => setActiveTab('menu')}
                />
                <div role="tabpanel" className="tab-content admin-table-container !p-6 w-full max-w-none">
                    {activeTab === 'menu' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="border-b pb-2 mb-4">
                                <h3 className="text-lg font-medium text-[var(--color-primary)]">Menú Principal (Tienda)</h3>
                                <p className="text-sm text-gray-500 mt-1">Configura los enlaces que aparecen en la barra de navegación pública superior.</p>
                            </div>

                            <input type="hidden" name="main_menu" value={JSON.stringify(menuItems)} />

                            <div className="flex gap-4 mb-6">
                                <button type="button" onClick={() => addMenuItem('link')} className="admin-btn admin-btn-secondary">
                                    + Añadir Enlace Libre
                                </button>
                                <button type="button" onClick={() => addMenuItem('categories')} className="admin-btn admin-btn-secondary" disabled={menuItems.some(i => i.type === 'categories')}>
                                    + Añadir Bloque de Categorías
                                </button>
                            </div>

                            <div className="space-y-3">
                                {menuItems.map((item, index) => (
                                    <div key={item.id} className="flex gap-4 items-center admin-table-container !p-5 !overflow-visible !rounded-xl !mb-2 relative w-full">
                                        <div className="flex flex-col gap-1">
                                            <button type="button" onClick={() => moveMenuItem(index, 'up')} disabled={index === 0} className="p-1 text-gray-400 hover:text-[var(--color-primary)] disabled:opacity-30">▲</button>
                                            <button type="button" onClick={() => moveMenuItem(index, 'down')} disabled={index === menuItems.length - 1} className="p-1 text-gray-400 hover:text-[var(--color-primary)] disabled:opacity-30">▼</button>
                                        </div>

                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6">
                                            <div className="admin-form-group mb-0">
                                                <label className="text-xs font-semibold text-gray-500 block mb-1">Etiqueta</label>
                                                <input
                                                    type="text"
                                                    value={item.label}
                                                    onChange={(e) => updateMenuItem(item.id, 'label', e.target.value)}
                                                    className="admin-form-input p-2"
                                                />
                                            </div>
                                            {item.type === 'link' ? (
                                                <div className="admin-form-group mb-0">
                                                    <label className="text-xs font-semibold text-gray-500 block mb-1">Ruta / URL (Ej: /blog)</label>
                                                    <input
                                                        type="text"
                                                        value={item.url || ''}
                                                        onChange={(e) => updateMenuItem(item.id, 'url', e.target.value)}
                                                        className="admin-form-input p-2"
                                                        placeholder="/"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="admin-form-group mb-0 flex flex-col pt-3 gap-3">
                                                    <div className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] px-3 py-1.5 rounded-lg text-sm font-medium w-fit">
                                                        [Módulo Dinámico: Categorías de Tienda]
                                                    </div>
                                                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-[var(--color-text-primary)]">
                                                        <input
                                                            type="checkbox"
                                                            checked={item.showAllCategories || false}
                                                            onChange={(e) => updateMenuItem(item.id, 'showAllCategories', e.target.checked)}
                                                            className="w-4 h-4 text-[var(--color-primary)] rounded"
                                                        />
                                                        <span>Desplegar todas las categorías como enlaces separados</span>
                                                    </label>
                                                    <p className="text-xs text-gray-500 italic mt-0">
                                                        Si está desactivado, se mostrará un único enlace "{item.label}" que llevará a la página principal de categorías.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <button type="button" onClick={() => removeMenuItem(item.id)} className="text-red-500 hover:text-red-700 p-2 hidden-mobile">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                ))}
                                {menuItems.length === 0 && <p className="text-gray-500 text-sm italic">El menú está vacío. Los usuarios no verán enlaces de navegación.</p>}
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
                <div role="tabpanel" className="tab-content admin-table-container !p-6 w-full max-w-none">
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
                                            <div key={idx} className="relative aspect-video admin-table-container rounded-md overflow-hidden">
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
                <div role="tabpanel" className="tab-content admin-table-container !p-6 w-full max-w-none">
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
                                <div className="admin-form-group grid-cols-1 md:col-span-2 mt-4 pt-4 border-t">
                                    <label className="admin-form-label text-[var(--color-primary)]">Rutas: Prefijo de URL para Páginas de Contenido</label>
                                    <input name="pages_prefix" className="admin-form-input" defaultValue={settingsMap['pages_prefix'] ?? ''} placeholder="" />
                                    <p className="text-xs text-gray-500 mt-1">Escribe "page" para que las URLs sean <code>/page/mi-pagina</code>. Déjalo completamente vacío para que estén en la raíz: <code>/mi-pagina</code>.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- TAB EMAIL & NOTIFICACIONES --- */}
                <input
                    type="radio"
                    name="settings_tabs"
                    role="tab"
                    className="tab font-semibold"
                    style={{ whiteSpace: 'pre', minWidth: 'max-content', padding: '0 2rem' }}
                    aria-label="  Notificaciones (SMTP)  "
                    checked={activeTab === 'email'}
                    onChange={() => setActiveTab('email')}
                />
                <div role="tabpanel" className="tab-content admin-table-container !p-6 w-full max-w-none">
                    {activeTab === 'email' && (
                        <div className="space-y-4 animate-fadeIn">
                            <div className="border-b pb-2 mb-4">
                                <h3 className="text-lg font-medium text-[var(--color-primary)]">Servidor de Correo & Contacto</h3>
                                <p className="text-sm text-gray-500 mt-1">Configura las notificaciones de la tienda usando tu propio SMTP, y hacia dónde llegan los mensajes de contacto.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="admin-form-group md:col-span-2">
                                    <label className="admin-form-label">Email de Recepción de Contactos</label>
                                    <input type="email" name="contact_email_receiver" className="admin-form-input" defaultValue={settingsMap['contact_email_receiver'] || 'admin@tutienda.com'} placeholder="admin@tutienda.com" />
                                    <p className="text-xs text-gray-500 mt-1">A esta dirección llegarán los mensajes que te envíen usando el formulario de Contacto.</p>
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Remitente (Email FROM)</label>
                                    <input name="smtp_from" className="admin-form-input" defaultValue={settingsMap['smtp_from'] || 'no-reply@tutienda.com'} />
                                    <p className="text-xs text-gray-500 mt-1">Aparece como "De:" en los emails.</p>
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Host SMTP</label>
                                    <input name="smtp_host" className="admin-form-input" defaultValue={settingsMap['smtp_host'] || ''} placeholder="mail.tutienda.com o smtp.gmail.com" />
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Puerto SMTP</label>
                                    <input name="smtp_port" type="number" className="admin-form-input" defaultValue={settingsMap['smtp_port'] || '465'} placeholder="465, 587 o 25" />
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Usuario SMTP</label>
                                    <input name="smtp_user" className="admin-form-input" defaultValue={settingsMap['smtp_user'] || ''} />
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Contraseña SMTP</label>
                                    <input type="password" name="smtp_pass" className="admin-form-input" defaultValue={settingsMap['smtp_pass'] || ''} />
                                    <p className="text-xs text-gray-500 mt-1">Tu clave de la cuenta de correo. Recomendado cuenta dedicada.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Botón Flotante / Fijo abajo para guardar sea cual sea la pestaña */}
            <div className="mt-8 flex justify-start pb-4">
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
