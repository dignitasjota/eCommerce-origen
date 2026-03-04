# Contexto del Proyecto eCommerce

Bienvenido al proyecto. Este documento (`CLAUDE.md`) sirve como base de conocimiento para entender la arquitectura, las decisiones de diseño y las particularidades del entorno de este eCommerce. 

## 1. Stack Tecnológico
- **Framework Core:** Next.js 16.1.6 (App Router, Turbopack)
- **Lenguaje:** TypeScript / React 18
- **Base de Datos:** MariaDB / MySQL alojada remotamente.
- **ORM:** Prisma (`@prisma/client` ^7.4.1)
- **Autenticación:** NextAuth.js (v5 Beta)
- **Internacionalización (i18n):** `next-intl` (Español por defecto, con soporte para Inglés `en`). Las rutas se envuelven en el segmento dinámico `[locale]`.
- **Estilos:** Tailwind CSS v4 + DaisyUI v5, usando CSS Vanilla para configuración y variables CSS (`index.css`).
- **Emails:** Nodemailer

## 2. Entorno de Producción (¡Muy Importante!)
- **Hosting:** **Plesk** utilizando Phusion Passenger para servir la aplicación Node.js.
- **Peculiaridades de Plesk:**
  - No hay acceso SSH directo para el usuario.
  - El middleware de Next.js de vez en cuando tiene comportamientos de reescritura estrictos.
  - Para desplegar cambios *reales* en producción, no basta con descargar el código vía Git; es **estrictamente necesario** ir al panel Node.js de Plesk, hacer clic en "Run Script" -> `build` (que ejecuta `npx prisma generate && next build` para recompilar la carpeta `.next`) y acto seguido hacer clic en **"Restart App"**.
  - Si hay un error fatal durante la compilación (`build`), Next.js o Plesk puede silenciarlo de cara al frontend sirviendo la versión guardada en caché. Siempre hay que mirar los logs y asegurar que el directorio raíz esté limpio de scripts `.js`/`.ts` de pruebas, porque interfieren con el `build` si tienen errores tipográficos.

## 3. Estructura del Proyecto
El proyecto sigue el estándar del App Router de Next.js, pero dividido en dos "grupos de rutas" lógicos (`route groups`):

```text
src/
├── app/
│   └── [locale]/
│       ├── (backoffice)/admin/  # Panel de administración cerrado
│       │   ├── dashboard/ 
│       │   ├── products/ 
│       │   ├── pages/           # Gestión de páginas dinámicas
│       │   └── settings/        # Configuración (SiteSettings)
│       └── (storefront)/        # Tienda pública front-end
│           ├── [...dynamicSlug]/# Renderizador principal de Páginas Generales y Legales
│           ├── product/[slug]/  # Vista individual
│           ├── cart/
│           ├── checkout/
│           └── auth/
├── components/                  # Componentes de UI reusables
├── i18n/                        # Configuración de next-intl (navigation.ts, requests.ts)
├── lib/
│   └── db.ts                    # Instancia singleton del cliente Prisma
└── middleware.ts                # Interceptor de next-intl para idioma /es/ o /en/
```

## 4. Estructura de Base de Datos y Patrones Clave
Para la internacionalización en base de datos, usamos un patrón de tablas de traducción. Por ejemplo, la tabla principal `Product` contiene el precio y el stock, pero los nombres y descripciones están en la tabla hija `ProductTranslation` unida a un `locale`.

### Tablas Principales:
- **Products & Categories**: Productos y sistema de taxonomía jerárquica.
- **Pages & LegalPages**: Sistema dual para páginas.
- **SiteSettings**: Tabla clave-valor para la configuración global de la tienda (emails de contacto, prefijos, moneda, etc.).

### Lógica de Páginas Dinámicas (`/src/app/[locale]/(storefront)/[...dynamicSlug]/page.tsx`):
- Esta es la ruta "comodín" o "catch-all" del front end. 
- Primero comprueba si el slug coincide con una página legal (`LegalPage`).
- Si no, recoge de la base de datos el ajuste `pages_prefix`. Si este existe (ej. `page`), las páginas se procesan bajo `/page/slug-de-pagina`. Si viene vacío o literal `"null"`, las páginas cuelgan de la raíz `/slug-de-pagina`.
- **Shortcodes**: El contenido enriquecido (HTML) de las páginas soporta "bloques dinámicos" o macros. Ej: `{{category_id:audio}}`. El código en `DynamicPageView` parsea el contenido de la página, intercepta esto usando Regex, y renderiza directamente un listado de productos de la categoría con slug `audio`.

## 5. Historial Reciente de Debugging
Si vas a retomar el trabajo, estos últimos días hemos estado lidiando con lo siguiente:
- **Error 404 en Páginas Creadas desde Admin**: Las páginas se guardaban bien en DB, pero no se podían visitar en la URL.
- **Motivo Original Encontrado**:
  1. El campo `pages_prefix` en Panel de Control enviaba a veces en la DB el valor string literal `"null"` cuando se dejaba vacío. NextJS estaba interpretando esto literalmente, forzando a que las URLs fuesen `/es/null/PAGINA`. Hemos programado una comprobación defensiva que hace `prefix !== 'null'` para evitar eso.
  2. Fallo de compilación oculto en Plesk. Como se dejaron scripts de testing sueltos en raíz (`test_db3.ts`, `test_db6.ts`), Next.js intentaba compilarlos durante el `build`, fallaban al no tener tipos/contexto correctos, y Plesk cancelaba secretamente el build, manteniendo una versión rota (con caché) de la aplicación. Eliminados los scripts, el build pasará.
  3. Se ha puesto una **pantalla de DEBUG en fondo rojo** dentro del `[...dynamicSlug]/page.tsx` en caso de NotFound (404) para ver de forma transparente qué parámetros y variables ha deducido Next.js sobre la ruta solicitada antes de caer.

## 6. Filosofía de Desarrollo / Directrices para la IA
- **Robustez Primero**: Comprueba siempre los casos nulos, undefined o las bases de datos vacías.
- **Diseño Premium**: En los componentes del storefront se exige un diseño atractivo (glassmorphism flex, Tailwind + DaisyUI, paletas equilibradas predefinidas en CSS variables).
- **Rutas Absolutas**: Si crees scripts o modificas la estructura, utiliza siempre comandos y rutas asumiendo la raíz del proyecto.
- **Minimiza la magia en Server Actions**: Siempre valida las entradas antes de inyectarlas en Prisma querys y en los Updates envuelve traducciones y tabla base en `prisma.$transaction([])` para mantener consistencia atomica.
