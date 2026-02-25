'use client';

import React, { useState, useMemo } from 'react';
import { createUser, updateUser, deleteUser } from './actions';

export default function UsersManager({ initialUsers }: { initialUsers: any[] }) {
    const [activeTab, setActiveTab] = useState<'customers' | 'system'>('customers');
    const [users, setUsers] = useState(initialUsers);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            if (activeTab === 'system') return u.role === 'ADMIN' || u.role === 'ORDER_MANAGER';
            return u.role === 'CUSTOMER';
        });
    }, [users, activeTab]);

    // Form states
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState('CUSTOMER');
    const [password, setPassword] = useState('');

    // Address states (Only for Customers)
    const [addressId, setAddressId] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [address1, setAddress1] = useState('');
    const [city, setCity] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [country, setCountry] = useState('España');
    const [stateRegion, setStateRegion] = useState('');

    const roleLabels: Record<string, string> = { ADMIN: 'Administrador', ORDER_MANAGER: 'Gestor (Pedidos)', CUSTOMER: 'Cliente normal' };
    const roleColors: Record<string, string> = { ADMIN: 'purple', ORDER_MANAGER: 'blue', CUSTOMER: '' };

    const openModal = (user: any = null) => {
        setEditingUser(user);
        if (user) {
            setName(user.name || '');
            setEmail(user.email || '');
            setPhone(user.phone || '');
            setRole(user.role || 'CUSTOMER');
            setPassword(''); // Nunca mostramos la contraseña al editar, la dejamos blanca para indicar "no cambiar"

            if (user.role === 'CUSTOMER') {
                const defaultAddress = user.addresses?.[0];
                if (defaultAddress) {
                    setAddressId(defaultAddress.id);
                    setFirstName(defaultAddress.first_name || '');
                    setLastName(defaultAddress.last_name || '');
                    setAddress1(defaultAddress.address1 || '');
                    setCity(defaultAddress.city || '');
                    setPostalCode(defaultAddress.postal_code || '');
                    setCountry(defaultAddress.country || 'España');
                    setStateRegion(defaultAddress.state || '');
                } else {
                    resetAddressFields();
                }
            } else {
                resetAddressFields();
            }
        } else {
            setName('');
            setEmail('');
            setPhone('');
            setRole(activeTab === 'customers' ? 'CUSTOMER' : 'ADMIN');
            setPassword('');
            resetAddressFields();
        }
        setIsModalOpen(true);
    };

    const resetAddressFields = () => {
        setAddressId('');
        setFirstName('');
        setLastName('');
        setAddress1('');
        setCity('');
        setPostalCode('');
        setCountry('España');
        setStateRegion('');
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        formData.append('phone', phone);
        formData.append('role', role);
        if (password) {
            formData.append('password', password);
        } else if (!editingUser) {
            alert('Debes establecer una contraseña inicial para el nuevo usuario');
            setIsLoading(false);
            return;
        }

        if (role === 'CUSTOMER') {
            if (addressId) formData.append('address_id', addressId);
            formData.append('first_name', firstName);
            formData.append('last_name', lastName);
            formData.append('address1', address1);
            formData.append('city', city);
            formData.append('postal_code', postalCode);
            formData.append('country', country);
            formData.append('state', stateRegion);
        }

        try {
            if (editingUser) {
                await updateUser(editingUser.id, formData);
            } else {
                await createUser(formData);
            }
            window.location.reload();
        } catch (error: any) {
            console.error(error);
            alert(error.message || 'Error al guardar el usuario');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, userName: string) => {
        if (!confirm(`¿Seguro que deseas eliminar la cuenta de ${userName || 'este usuario'}? (Esta acción también borrará sus datos)`)) return;
        setIsLoading(true);
        try {
            await deleteUser(id);
            window.location.reload();
        } catch (error: any) {
            console.error(error);
            alert(error.message || 'Error al eliminar');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="admin-topbar">
                <h1 className="admin-topbar-title">Usuarios y Clientes</h1>
                <div className="admin-topbar-actions">
                    <button onClick={() => openModal()} className="admin-btn admin-btn-primary">
                        + Registrar Usuario Interno
                    </button>
                </div>
            </div>

            {/* Navegación por Pestañas (Estilo Archivador) */}
            <div style={{ padding: '0 2rem' }}>
                <div className="flex border-b border-[var(--color-border)] mb-6 overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab('customers')}
                        className={`px-6 py-3 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors -mb-[1px] ${activeTab === 'customers' ? 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-primary)] relative z-10' : 'bg-gray-50/50 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'}`}
                    >
                        🛍️ Clientes
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('system')}
                        className={`px-6 py-3 text-sm font-semibold rounded-t-lg border border-b-0 transition-colors -mb-[1px] ml-1 ${activeTab === 'system' ? 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-primary)] relative z-10' : 'bg-gray-50/50 border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'}`}
                    >
                        🛡️ Usuarios del Sistema
                    </button>
                </div>
            </div>

            <div className="admin-page" style={{ paddingTop: 0 }}>
                <div className="admin-table-container">
                    <div className="admin-table-header">
                        <h2 className="admin-table-title">
                            {filteredUsers.length} {activeTab === 'customers' ? 'clientes registrados' : 'cuentas del sistema'}
                        </h2>
                    </div>
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Nombre Completo</th>
                                <th>Correo Electrónico</th>
                                <th>Teléfono</th>
                                <th>Permisos/Rol</th>
                                <th>Pedidos</th>
                                <th>Registro</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((u) => (
                                <tr key={u.id}>
                                    <td style={{ fontWeight: 600 }}>{u.name || '—'}</td>
                                    <td>{u.email}</td>
                                    <td style={{ fontSize: '0.85rem' }}>{u.phone || '—'}</td>
                                    <td>
                                        <span className={`admin-badge ${roleColors[u.role] || 'active'}`} style={u.role === 'ADMIN' ? { background: 'rgba(168,85,247,0.1)', color: '#a855f7' } : u.role === 'ORDER_MANAGER' ? { background: 'rgba(59,130,246,0.1)', color: '#3b82f6' } : {}}>
                                            {roleLabels[u.role] || 'Cliente'}
                                        </span>
                                    </td>
                                    <td>
                                        <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                                            {u._count.orders > 0 ? `${u._count.orders} uds.` : '—'}
                                        </span>
                                    </td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                        {new Date(u.created_at).toLocaleDateString('es-ES')}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => openModal(u)} className="admin-btn admin-btn-secondary admin-btn-sm">
                                                Editar
                                            </button>
                                            <button onClick={() => handleDelete(u.id, u.name || u.email)} className="admin-btn admin-btn-danger admin-btn-sm" title="Borrar Cuenta">
                                                Borrar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Configuración de Usuario */}
            {isModalOpen && (
                <div className="admin-modal-overlay" onClick={closeModal}>
                    <div className="admin-modal" onClick={e => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h2 className="admin-modal-title">
                                {editingUser ? 'Modificar Usuario / Permisos' : 'Crear nueva cuenta / Alta manual'}
                            </h2>
                            <button className="admin-modal-close" onClick={closeModal}>×</button>
                        </div>

                        <form onSubmit={handleSave} className="admin-form" style={{ padding: 0, border: 'none' }}>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Nombre y Apellidos</label>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ej: Laura Méndez"
                                />
                            </div>

                            <div className="admin-form-row">
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Correo Electrónico *</label>
                                    <input
                                        type="email"
                                        className="admin-form-input"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value.toLowerCase())}
                                        required
                                        placeholder="ejemplo@correo.com"
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Teléfono de Contacto</label>
                                    <input
                                        type="tel"
                                        className="admin-form-input"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="+34 XXXXXX"
                                    />
                                </div>
                            </div>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Nivel de Permisos (Rol)</label>
                                <select
                                    className="admin-form-select"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    required
                                >
                                    <option value="CUSTOMER">Cliente Estándar (Sólo Compras)</option>
                                    <option value="ORDER_MANAGER">Gestor de Pedidos (Acceso parcial a Backoffice)</option>
                                    <option value="ADMIN">Administrador Global (Acceso Total)</option>
                                </select>
                            </div>

                            <hr style={{ margin: '1.5rem 0', borderColor: 'var(--color-border)' }} />

                            <div className="admin-form-group">
                                <label className="admin-form-label">{editingUser ? 'Nueva Contraseña (Dejar en blanco para NO cambiarla)' : 'Contraseña Inicial *'}</label>
                                <input
                                    type="text" // Se usa text o password. Siendo admin, es mejor text para ver qué generas al empleado, o password. Lo dejo text
                                    className="admin-form-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={editingUser ? '********' : 'Escribe una contraseña segura'}
                                    minLength={6}
                                />
                                {editingUser && <p style={{ fontSize: '0.8rem', color: 'gray', marginTop: '0.25rem' }}>Si el usuario olvidó su clave, puedes forzar una nueva aquí enviándosela luego de forma segura.</p>}
                            </div>

                            {role === 'CUSTOMER' && (
                                <>
                                    <hr style={{ margin: '1.5rem 0', borderColor: 'var(--color-border)' }} />
                                    <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 'bold' }}>Dirección de Envío Principal</h3>

                                    <div className="admin-form-row">
                                        <div className="admin-form-group">
                                            <label className="admin-form-label">Nombre del receptor</label>
                                            <input type="text" className="admin-form-input" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ej: Juan" />
                                        </div>
                                        <div className="admin-form-group">
                                            <label className="admin-form-label">Apellidos del receptor</label>
                                            <input type="text" className="admin-form-input" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Ej: Pérez" />
                                        </div>
                                    </div>

                                    <div className="admin-form-group">
                                        <label className="admin-form-label">Dirección (Calle, número, piso...)</label>
                                        <input type="text" className="admin-form-input" value={address1} onChange={e => setAddress1(e.target.value)} placeholder="Ej: Calle Principal 123, 4ºB" />
                                    </div>

                                    <div className="admin-form-row">
                                        <div className="admin-form-group">
                                            <label className="admin-form-label">Ciudad</label>
                                            <input type="text" className="admin-form-input" value={city} onChange={e => setCity(e.target.value)} placeholder="Ej: Madrid" />
                                        </div>
                                        <div className="admin-form-group">
                                            <label className="admin-form-label">Provincia / Región</label>
                                            <input type="text" className="admin-form-input" value={stateRegion} onChange={e => setStateRegion(e.target.value)} placeholder="Ej: Comunidad de Madrid" />
                                        </div>
                                    </div>

                                    <div className="admin-form-row">
                                        <div className="admin-form-group">
                                            <label className="admin-form-label">Código Postal</label>
                                            <input type="text" className="admin-form-input" value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="Ej: 28001" />
                                        </div>
                                        <div className="admin-form-group">
                                            <label className="admin-form-label">País</label>
                                            <input type="text" className="admin-form-input" value={country} onChange={e => setCountry(e.target.value)} placeholder="Ej: España" />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="admin-btn admin-btn-secondary" onClick={closeModal}>
                                    Cancelar
                                </button>
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={isLoading}>
                                    {isLoading ? 'Guardando...' : 'Guardar Ficha de Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
