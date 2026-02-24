1. El archivo mágico: server.js
A diferencia de ejecutar npm run start en tu ordenador, el motor interno de Plesk siempre necesita un archivo "punto de entrada" (entry point) para saber cómo arrancar la aplicación.

En tu ordenador (localmente), crea un nuevo archivo llamado server.js en la raíz de tu proyecto (junto a tu package.json) y pega este código exacto:

javascript
// server.js
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const app = next({ dev: false })
const handle = app.getRequestHandler()
app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  }).listen(process.env.PORT || 3000)
})
2. Modifica temporalmente tu package.json
El panel de Plesk instalará los paquetes solos, pero a diferencia de tu PC, Plesk se olvidará de preparar la base de datos (Prisma). Para obligarlo a crear el cliente de Prisma tras instalar, añade esta línea a tus "scripts" dentro del archivo package.json:

json
"scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "postinstall": "prisma generate"  // <--- AÑADE ESTA LÍNEA
  },
3. FASE LOCAL: ¡Compilar!
Siempre compila (construye) el proyecto en el Mac antes de enviarlo por FTP. Ejecuta esto en tu terminal local:

bash
npm run build
4. FASE FTP: Súbelo todo a Plesk
Abre tu programa de FTP (FileZilla o el propio Gestor de Plesk) y ve a la carpeta de tu dominio (suele llamarse httpdocs en Plesk). Borra cualquier archivo viejo e index genérico que traiga Plesk y sube ÚNICAMENTE esto:

La carpeta .next (entera)
La carpeta public (entera)
La carpeta 

prisma
 (entera)
Tus archivos package.json y package-lock.json
Tu archivo oculto 

.env
 (donde pusiste las contraseñas de BBDD)
El nuevo archivo server.js
(Jamás subas la carpeta node_modules ni src, tardarías horas y no sirve de nada en producción).

5. Configurar Plesk ⚙️
Ve al panel principal de tu dominio en Plesk y busca un botón llamado Node.js (si no lo tienes, dile al dueño del VPS que instale la extensión Node.js desde el catálogo de Plesk).
Haz clic en Habilitar Node.js e introduce esta configuración:
Versión de Node.js: Selecciona Node 18.x o 20.x LTS.
Application Root / Raíz de la app: Selecciona la ruta de tu web (ej: /httpdocs).
Document Root / Raíz del documento: Aquí debes escribir exactamente la ruta hacia tu carpeta pública: /httpdocs/public (esto es importante para cargar imágenes).
Modo de aplicación: Ponlo en production.
Archivo de inicio de la aplicación / Application Startup File: Escribe aquí el nombre que definimos: server.js.
6. Instalar y Encender 🚀
Guarda todas esas configuraciones de la pestaña Node.js.
Ahí mismo verás un botón que dice "NPM Install" (Instalar dependencias de NPM). Púlsalo. Verás que se pone a pensar; está descargando tus módulos de los autores originales y compilando tu base de datos mediante el comando postinstall.
Una vez finalice, pulsa el botón "Reiniciar App" (Restart App).
Abre tu web... ¡Y verás tu E-commerce de compras funcionando velozmente online! Plesk se encargará detrás de cámaras de gestionar todo el tráfico Nginx y de mantener activo el proceso de Node.js siempre.

