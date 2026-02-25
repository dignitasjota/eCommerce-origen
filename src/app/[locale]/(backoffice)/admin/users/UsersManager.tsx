'use client';

import React, { useState, useMemo } from 'react';
import { createUser, updateUser, deleteUser } from './actions';

export default function UsersManager({ initialUsers }: { initialUsers: any[] }) {
    const [activeTab, setActiveTab] = useState<'customers' | 'system'>('customers');
    const [users, setUsers] = useState(initialUsers);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string } | null>(null);

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

    const handleDelete = (id: string, userName: string) => {
        setItemToDelete({ id, name: userName || 'este usuario' });
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        setIsLoading(true);
        try {
            await deleteUser(itemToDelete.id);
            window.location.reload();
        } catch (error: any) {
            console.error(error);
            alert(error.message || 'Error al eliminar');
        } finally {
            setIsLoading(false);
            setItemToDelete(null);
        }
    };

    return (
        <>
            <div className="flex justify-between items-center mb-8 px-8 pt-8">
                <h1 className="text-3xl font-bold">Usuarios y Clientes</h1>
                <div className="flex gap-4">
                    <button onClick={() => openModal()} className="btn btn-primary">
                        + Registrar Usuario Interno
                    </button>
                </div>
            </div>

            <div className="px-8 pb-8">
                <div role="tablist" className="tabs tabs-lift tabs-lg">
                    {/* --- TAB CLIENTES --- */}
                    <input
                        type="radio"
                        name="users_tabs"
                        role="tab"
                        className="tab font-semibold"
                        aria-label="🛍️ Clientes"
                        checked={activeTab === 'customers'}
                        onChange={() => setActiveTab('customers')}
                    />
                    <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6 shadow-sm overflow-hidden">
                        {activeTab === 'customers' && (
                            <div className="overflow-x-auto">
                                <div className="flex justify-between items-center pb-4 mb-4 border-b border-base-200">
                                    <h2 className="card-title text-xl">
                                        {filteredUsers.length} clientes registrados
                                    </h2>
                                </div>
                                <table className="table table-zebra table-md w-full">
                                    <thead>
                                        <tr className="bg-base-200">
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
                                            <tr key={u.id} className="hover">
                                                <td className="font-bold">{u.name || '—'}</td>
                                                <td>{u.email}</td>
                                                <td className="text-sm">{u.phone || '—'}</td>
                                                <td>
                                                    <div className="badge badge-ghost">Cliente</div>
                                                </td>
                                                <td>
                                                    <span className="font-bold text-primary">
                                                        {u._count.orders > 0 ? `${u._count.orders} uds.` : '—'}
                                                    </span>
                                                </td>
                                                <td className="text-xs text-base-content/70">
                                                    {new Date(u.created_at).toLocaleDateString('es-ES')}
                                                </td>
                                                <td>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => openModal(u)} className="btn btn-outline btn-sm">
                                                            Editar
                                                        </button>
                                                        <button onClick={() => handleDelete(u.id, u.name || u.email)} className="btn btn-error btn-sm" title="Borrar Cuenta">
                                                            Borrar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* --- TAB SISTEMA --- */}
                    <input
                        type="radio"
                        name="users_tabs"
                        role="tab"
                        className="tab font-semibold"
                        aria-label="🛡️ Usuarios del Sistema"
                        checked={activeTab === 'system'}
                        onChange={() => setActiveTab('system')}
                    />
                    <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6 shadow-sm overflow-hidden">
                        {activeTab === 'system' && (
                            <div className="overflow-x-auto">
                                <div className="flex justify-between items-center pb-4 mb-4 border-b border-base-200">
                                    <h2 className="card-title text-xl">
                                        {filteredUsers.length} cuentas del sistema
                                    </h2>
                                </div>
                                <table className="table table-zebra table-md w-full">
                                    <thead>
                                        <tr className="bg-base-200">
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
                                            <tr key={u.id} className="hover">
                                                <td className="font-bold">{u.name || '—'}</td>
                                                <td>{u.email}</td>
                                                <td className="text-sm">{u.phone || '—'}</td>
                                                <td>
                                                    <div className={`badge ${u.role === 'ADMIN' ? 'badge-primary badge-outline' : 'badge-info badge-outline'}`}>
                                                        {roleLabels[u.role] || 'Cliente'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="font-bold text-primary">
                                                        {u._count.orders > 0 ? `${u._count.orders} uds.` : '—'}
                                                    </span>
                                                </td>
                                                <td className="text-xs text-base-content/70">
                                                    {new Date(u.created_at).toLocaleDateString('es-ES')}
                                                </td>
                                                <td>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => openModal(u)} className="btn btn-outline btn-sm">
                                                            Editar
                                                        </button>
                                                        <button onClick={() => handleDelete(u.id, u.name || u.email)} className="btn btn-error btn-sm" title="Borrar Cuenta">
                                                            Borrar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
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
            {/* Delete Confirmation Modal */}
            {itemToDelete && (
                <div className="modal modal-open modal-bottom sm:modal-middle">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg text-error">Confirmar borrado</h3>
                        <p className="py-4">¿Seguro que deseas eliminar la cuenta de <strong>{itemToDelete.name}</strong>? Esta acción también borrará sus datos y pedidos asociados.</p>
                        <div className="modal-action">
                            <button className="btn btn-ghost" onClick={() => setItemToDelete(null)} disabled={isLoading}>
                                Cancelar
                            </button>
                            <button className="btn btn-error" onClick={confirmDelete} disabled={isLoading}>
                                {isLoading ? <span className="loading loading-spinner"></span> : 'Eliminar permanentemente'}
                            </button>
                        </div>
                    </div>
                    <form method="dialog" className="modal-backdrop">
                        <button onClick={() => setItemToDelete(null)}>close</button>
                    </form>
                </div>
            )}
        </>
    );
}
