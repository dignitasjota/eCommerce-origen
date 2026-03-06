const fs = require('fs');

// SettingsForm: we just need to ensure the end matches correctly
let settings = fs.readFileSync('src/app/[locale]/(backoffice)/admin/settings/SettingsForm.tsx', 'utf8');
settings = settings.replace(/\n\s*\}\)\;\s*\}\s*$/m, '\n</form>\n);\n}\n');
settings = settings.replace(/<\/div>\s*<\/div>\s*\{\/\* Botón Flotante/g, '</div>\n\n{/* Botón Flotante');

// Let's be very safe, rewrite the end of SettingsForm manually:
// Find from "    {/* Botón Flotante" to the end
let pt_settings = settings.split('{/* Botón Flotante');
let before_settings = pt_settings[0].replace(/<\/div>\s*<\/div>\s*$/m, '</div>\n');
let new_settings = before_settings + '{/* Botón Flotante' + pt_settings[1].replace(/<\/form\s*>\s*<\/form\s*>/g, '</form>').replace(/<\/form\s*>\s*$/m, '</form>\n);}\n');

fs.writeFileSync('src/app/[locale]/(backoffice)/admin/settings/SettingsForm.tsx', new_settings);

// UsersManager:
let users = fs.readFileSync('src/app/[locale]/(backoffice)/admin/users/UsersManager.tsx', 'utf8');
// Replace the block of divs before modal
users = users.replace(/<\/div>\s*<\/div>\s*\{\/\* Modal de Configuración/g, '</div>\n            </div>\n\n            {/* Modal de Configuración');
users = users.replace(/<\/div>\s*<\/div>\s*<\/div>\s*\{\/\* Modal de/g, '</div>\n            </div>\n\n            {/* Modal de');
// Fix the end of the file too
users = users.replace(/<\/div>\s*<\/>\s*\)\;\s*\}\s*$/m, '</div>\n        </>\n    );\n}\n');

fs.writeFileSync('src/app/[locale]/(backoffice)/admin/users/UsersManager.tsx', users);
