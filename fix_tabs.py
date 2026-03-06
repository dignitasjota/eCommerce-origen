import re

with open('src/app/[locale]/(backoffice)/admin/settings/SettingsForm.tsx', 'r') as f:
    settings_code = f.read()

# Replace the start of tabs
settings_start_replacement = """            {/* --- CUSTOM TABS NAVIGATION --- */}
            <div className="flex border-b border-[var(--color-border)] mb-6 overflow-x-auto gap-4 hide-scrollbar">
                {[
                    { id: 'general', label: 'Configuración Global' },
                    { id: 'modules', label: 'Módulos Frontend' },
                    { id: 'menu', label: 'Menú Principal' },
                    { id: 'carousel', label: 'Carrusel Inicio' },
                    { id: 'seo', label: 'SEO' },
                    { id: 'email', label: 'Notificaciones (SMTP)' }
                ].map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors duration-200 border-b-2 mb-[-1px] ${activeTab === item.id 
                            ? 'border-[var(--color-primary)] text-[var(--color-primary)]' 
                            : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)]'
                        }`}
                        onClick={() => setActiveTab(item.id)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <div className="admin-table-container p-6 shadow-sm w-full">
"""

settings_code = re.sub(
    r'<div role="tablist" className="tabs tabs-lift tabs-lg w-full mb-8">.*?(?=\{activeTab === \'general\' && \()',
    settings_start_replacement,
    settings_code,
    flags=re.DOTALL
)

# Remove the intermediate tab definitions
intermediate_tabs_regexes = [
    r'</div>\s*\{/\* --- TAB MÓDULOS ---\s*\*/\}.*?(?=\{activeTab === \'modules\' && \()',
    r'</div>\s*\{/\* --- TAB MENÚ ---\s*\*/\}.*?(?=\{activeTab === \'menu\' && \()',
    r'</div>\s*\{/\* --- TAB CARRUSEL ---\s*\*/\}.*?(?=\{activeTab === \'carousel\' && \()',
    r'</div>\s*\{/\* --- TAB SEO ---\s*\*/\}.*?(?=\{activeTab === \'seo\' && \()',
    r'</div>\s*\{/\* --- TAB EMAIL & NOTIFICACIONES ---\s*\*/\}.*?(?=\{activeTab === \'email\' && \()',
]

for regex in intermediate_tabs_regexes:
    settings_code = re.sub(regex, '\n', settings_code, flags=re.DOTALL)


# Write back
with open('src/app/[locale]/(backoffice)/admin/settings/SettingsForm.tsx', 'w') as f:
    f.write(settings_code)

print("SettingsForm tabs refactored.")

# Now for UsersManager
with open('src/app/[locale]/(backoffice)/admin/users/UsersManager.tsx', 'r') as f:
    users_code = f.read()

users_start_replacement = """                {/* --- CUSTOM TABS NAVIGATION --- */}
                <div className="flex border-b border-[var(--color-border)] mb-6 overflow-x-auto gap-4 hide-scrollbar">
                    {[
                        { id: 'customers', label: 'Clientes Registrados' },
                        { id: 'admins', label: 'Administradores' }
                    ].map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors duration-200 border-b-2 mb-[-1px] ${activeTab === item.id 
                                ? 'border-[var(--color-accent)] text-[var(--color-text-primary)]' 
                                : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border)]'
                            }`}
                            onClick={() => {
                                setActiveTab(item.id);
                                setSearchTerm('');
                            }}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <div className="admin-table-container" style={{ borderTopLeftRadius: 0, marginTop: '-1px' }}>
"""

users_code = re.sub(
    r'<div role="tablist" className="tabs tabs-lift tabs-lg w-full">.*?(?=\{activeTab === \'customers\' && \()',
    users_start_replacement,
    users_code,
    flags=re.DOTALL
)

users_code = re.sub(
    r'</div>\s*\{/\* --- TAB ADMINS ---\s*\*/\}.*?(?=\{activeTab === \'admins\' && \()',
    '\n',
    users_code,
    flags=re.DOTALL
)

# And remove the last closing div from the tabs container
# This is around line 351, right before the {isModalOpen && (
users_code = re.sub(
    r'</>\s*\)\}\s*</div\>\s*</div\>\s*\{isModalOpen',
    '</>\n                        )}\n                    </div>\n\n            {isModalOpen',
    users_code,
    flags=re.DOTALL
)

with open('src/app/[locale]/(backoffice)/admin/users/UsersManager.tsx', 'w') as f:
    f.write(users_code)

print("UsersManager tabs refactored.")

