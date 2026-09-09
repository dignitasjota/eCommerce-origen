# Plan de migración: Next.js / Prisma / dependencias con saltos de versión mayor

> Redactado el 2026-09-10 en la rama `chore/nextjs-prisma-major-upgrade-plan`, a raíz de los hallazgos de `npm audit` de la auditoría de seguridad de esta misma fecha. Es un documento de planificación — **no se ha ejecutado ninguna migración de versión mayor todavía**; las acciones de "Fase 0" son las únicas aplicadas o listas para aplicar de inmediato.

---

## Resumen ejecutivo

La investigación (fuentes oficiales: blog de Next.js, documentación de Prisma, GitHub de Prisma/Auth.js — ver [Fuentes](#fuentes)) concluye que **no hay ninguna migración de versión mayor urgente que ejecutar ahora mismo**:

- **Next.js**: no existe todavía una v17 (estable ni RC). El proyecto ya está en la última estable de la rama 16 (**16.3.4**, publicada 2026-08-03). No hay nada a lo que migrar.
- **Prisma**: la v8 sigue en **release candidate** (rc.9 en el momento de escribir esto), no estable. La v7 estable más reciente es **7.10.0**. Las vulnerabilidades que `npm audit` reporta contra el árbol de Prisz vienen de las dependencias de **tooling de desarrollo** (`@prisma/dev`, usado por `prisma studio`/CLI — no por el motor/cliente en runtime) y son un problema **conocido y sin resolver en toda la línea 7.x** ([prisma/prisma#29605](https://github.com/prisma/prisma/issues/29605)), no algo que una migración a 8-RC arregle de forma garantizada ni algo que justifique adoptar una release candidate en producción.
- **NextAuth/Auth.js v5**: sigue en beta (ya estamos en la última, `5.0.0-beta.32`, sin release "5.0.0" estable a la vista) — la comunidad trata las betas como production-ready.

Lo que sí hay son **4 paquetes con saltos de versión mayor pendientes** (identificados en la auditoría de seguridad, sección de `npm audit`) que quedaron deliberadamente sin tocar por riesgo de romper funcionalidad real sin poder probarla a fondo: `sharp`, `nodemailer`, `@tiptap/*` y, en menor medida, un desalineamiento interno de versiones de Prisma que sí conviene corregir ya.

**Recomendación:** ejecutar la Fase 0 (housekeeping de bajo riesgo) ahora; dejar las Fases 1-3 preparadas pero pendientes de disparadores concretos (ver [Criterios de disparo](#criterios-de-disparo)).

---

## Inventario de versiones (2026-09-10)

| Paquete | Instalado | Última disponible | Tipo de salto | Estado |
|---|---|---|---|---|
| `next` | 16.3.4 | 16.3.4 | — | ✅ Al día |
| `next-auth` | 5.0.0-beta.32 | 5.0.0-beta.32 | — | ✅ Al día (sigue en beta upstream) |
| `@auth/core` | 0.41.3 | 0.41.3 | — | ✅ Al día |
| `@auth/prisma-adapter` | 2.11.3 (declarado `^2.11.1`) | 2.11.3 | — | ✅ Al día |
| `prisma` (CLI) | 7.10.0 | 7.10.0 (8.0.0-rc.9 en RC) | — | ✅ Al día dentro de 7.x |
| `@prisma/client` | **7.4.1** (declarado `^7.4.1`) | 7.10.0 | Patch/minor, mismo rango | ⚠️ **Desalineado con la CLI** — ver Fase 0 |
| `@prisma/adapter-mariadb` | 7.10.0 (declarado `^7.4.1`) | 7.10.0 | — | ✅ Al día |
| `mariadb` (driver) | 3.5.4 (declarado `^3.5.1`) | — | — | ✅ Al día |
| `sharp` | 0.34.5 (declarado `^0.34.5`) | 0.35.4 | **Mayor** (breaking en `next/image`) | 🔶 Fase 2 |
| `nodemailer` | 7.0.13 (declarado `^7.0.13`) | 10.0.2 | **Mayor ×3** (7→8→9→10) | 🔶 Fase 3 |
| `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-*` | 2.27.2 (declarado `^2.27.2`) | 3.31.3 | **Mayor** (2→3, breaking en API de extensiones) | 🔶 Fase 3 |

---

## Fase 0 — Housekeeping de bajo riesgo (ejecutable ya)

Objetivo: eliminar inconsistencias dentro de rangos semver ya aprobados por `package.json`, sin ningún cambio de comportamiento esperado.

- [ ] **Realinear `@prisma/client` con la CLI de Prisma.** Ahora mismo `prisma` (CLI/generador) y `@prisma/adapter-mariadb` están en 7.10.0, pero `@prisma/client` quedó fijado en 7.4.1 — ambos satisfacen `^7.4.1`, así que `npm install` no lo tocó salvo que algo forzase una re-resolución. Mantener el cliente 6 versiones "menor" por detrás del generador que lo produce no es buena práctica: aunque Prisma intenta mantener compatibilidad, es una fuente innecesaria de bugs sutiles. Acción: `npm install @prisma/client@7.10.0` (dentro del mismo rango declarado, cero riesgo de breaking change) + `npx prisma generate` + smoke test (`tsc --noEmit`, `npm run build`, suite e2e completa) antes de fusionar.

No hay más acciones de Fase 0 — el resto de paquetes en `package.json` ya están en su última versión dentro de su rango semver declarado (confirmado con `npm outdated` / `npm view <pkg> version` el 2026-09-10).

---

## Fase 1 — Preparar (no fusionar) el puente a Prisma 8

Objetivo: tener el terreno allanado para cuando Prisma 8 salga de RC, sin comprometerse a una fecha ni adoptar software pre-release en producción.

Prisma publica `@prisma/prisma7`, un paquete de compatibilidad pensado exactamente para migrar de forma incremental de 7→8 sin tener que saltar de golpe. Cuando llegue el momento:

1. Rama dedicada desde `main` (no reutilizar ésta).
2. Instalar Prisma 8 + `@prisma/prisma7` como puente; NO tocar `prisma/schema.prisma` todavía.
3. Revisar breaking changes confirmados (changelog oficial de la 8.0.0 estable, no el RC actual — puede cambiar antes de GA):
   - `prisma.config.ts` — el proyecto ya usa este patrón (no el `.env`-only legacy), buena posición de partida, pero verificar el envoltorio exacto (`definePrismaConfig`) que exige 8.
   - Reorganización de subcomandos de la CLI (afecta a `scripts/docker-entrypoint.sh` y `.github/workflows/ci.yml`, que invocan `prisma db push`/`prisma generate` directamente).
   - `.take(n)`/`.skip(n)` renombrados a `.limit(n)`/`.offset(n)` — **impacto real**: el proyecto usa `take`/`skip` extensivamente (`src/lib/pagination.ts`, todos los listados admin, `cleanup-pending-orders`, etc.) — esto es un find-and-replace mecánico pero no trivial en volumen, requiere pasada completa + tests.
   - Los SQL builders tipados exigen namespace antes de model — **impacto mínimo**: el proyecto sólo usa `$queryRaw` para el `SELECT 1` de los healthchecks (`/api/health`, `/api/health/deep`), sin tipado complejo.
4. Confirmar en ese momento (no ahora, las versiones pueden cambiar) que `@auth/prisma-adapter` y `@prisma/adapter-mariadb` tienen release estable compatible con Prisma 8 GA (ambos ya se documentan oficialmente contra Prisma 8 en sus RC actuales, buena señal, pero re-verificar en el momento).
5. Todo el CI (`quality`, `e2e`, `docker-build`) debe pasar en verde en esa rama antes de plantear el merge a `main` — usar el mismo procedimiento de validación real (Node 22 + MariaDB en Docker + build + suite Playwright completa) que se ha usado en las últimas sesiones de esta auditoría, no sólo `tsc`.

---

## Fase 2 — `sharp` 0.34 → 0.35

- Usado internamente por `next/image` (optimización de imágenes on-the-fly) — no es una dependencia que el proyecto invoque directamente en su propio código (`grep -rn "from 'sharp'"` en `src/` no devuelve nada), así que el riesgo está en si Next.js 16.3.4 es compatible con sharp 0.35 o si necesita una versión específica.
- Las vulnerabilidades parcheadas son de `libvips`/`libheif` (procesamiento de imágenes) — relevantes porque el admin sube imágenes de producto desde archivos externos (aunque ya validadas por `src/lib/uploads.ts`: whitelist MIME + magic bytes).
- **Prueba requerida antes de fusionar:** subir una imagen de cada formato soportado (`jpg`, `png`, `webp`, `gif`) vía `ImageUploader` y confirmar que `next/image` las sirve y redimensiona correctamente en el storefront (galería de producto, home carousel, blog cover) — no basta con `tsc`/`build`, hay que verlo renderizado.

---

## Fase 3 — `nodemailer` 7 → 10 y `@tiptap/*` 2 → 3

Dos migraciones independientes entre sí, agrupadas en la misma fase por ser ambas de alto esfuerzo de verificación:

**`nodemailer` (7→8→9→10, tres majors):**
- Usado en `src/lib/email.ts` (único punto de entrada, ya centralizado — buena noticia, la superficie de cambio es pequeña) para todos los emails transaccionales (confirmación de pedido, reset de contraseña, devoluciones, carrito abandonado, newsletter).
- Antes de migrar: revisar el changelog de cada major (8, 9, 10) en busca de cambios en la firma de `createTransport`/`sendMail` y en el manejo de errores (el fix de esta sesión que hace que `sendEmail()` falle honestamente si no hay SMTP configurado depende de la forma exacta en que nodemailer lanza/devuelve errores).
- **Prueba requerida:** levantar un SMTP de pruebas local (p.ej. `MailHog`/`smtp4dev` en un contenedor, o `mailtrap.io`) y verificar el envío real de al menos: confirmación de pedido (COD), reset de contraseña, y el caso "SMTP mal configurado" (debe seguir fallando honesto, no silencioso).

**`@tiptap/*` (2→3):**
- Usado en `src/components/backoffice/RichTextEditor.tsx`, con StarterKit + Link + Image + Placeholder + TextAlign — Tiptap v3 reestructuró varias extensiones y su sistema de comandos.
- **Prueba requerida:** abrir el editor en ProductsManager/BlogManager/PagesManager/LegalManager, probar cada botón de la toolbar (H2/H3, bold/italic/strike/code, listas, cita, alineación, link, imagen, hr, undo/redo), confirmar que el HTML de salida sigue siendo compatible con `sanitizeHtml()` y que los shortcodes `{{category_id:slug}}` se siguen preservando como texto plano (comportamiento del que depende `[...dynamicSlug]/page.tsx`).

---

## Criterios de disparo

No fusionar ninguna fase por calendario — fusionar cuando se cumpla el disparador correspondiente:

| Fase | Disparador |
|---|---|
| 0 | Ninguno — ejecutable en cualquier momento, ya lista |
| 1 (Prisma 8) | Prisma 8.0.0 marcado **estable** (no RC) en [prisma.io/docs/orm/v7/more/releases](https://www.prisma.io/docs/orm/v7/more/releases) o release notes oficiales, **y** confirmación de que `@auth/prisma-adapter`/`@prisma/adapter-mariadb` tienen release estable compatible |
| 2 (sharp) | Cuando se toque `next/image`/`ImageUploader` por otro motivo (aprovechar el contexto ya cargado), o cada trimestre como revisión de rutina |
| 3 (nodemailer/tiptap) | Cuando aparezca un CVE/advisory que afecte a una función REALMENTE usada por el proyecto (no sólo a la superficie de API no usada), o cada trimestre como revisión de rutina |
| — (Next.js 17) | Cuando se anuncie — de momento sólo monitorizar [nextjs.org/blog](https://nextjs.org/blog) |

---

## Estrategia de pruebas (aplica a cualquier fase que se ejecute)

Mismo procedimiento usado en toda la auditoría de seguridad de esta sesión — no aceptar una fase como "lista para fusionar" sin:

1. `npx tsc --noEmit` limpio.
2. `npx eslint .` sin errores nuevos (comparar contra el árbol antes del cambio).
3. Entorno real: Node 22 (`nvm use 22` — necesario para el CLI de Prisma) + contenedor MariaDB 10.11 efímero + `prisma db push` + `seed-bootstrap.mjs`.
4. `npm run build` (build de producción) sin errores.
5. Suite Playwright e2e completa (`npm run test:e2e`) contra ese entorno real — no sólo los specs "obviamente relacionados", la suite completa, porque varias fases (Prisma, Next) tocan el runtime completo de la app.
6. Para Fases 2 y 3: verificación manual adicional específica (ver cada fase arriba) — `tsc`/`build`/e2e no ejercitan el procesamiento real de imágenes, el envío real de SMTP, ni cada botón del editor WYSIWYG.

## Plan de rollback

Cada fase vive en su propia rama, fusionada a `main` sólo tras pasar la estrategia de pruebas completa. Si algo se detecta roto en producción tras el merge: `git revert` del commit de merge (nunca `reset --hard` sobre `main` compartido) + `docker compose up -d --build` para redesplegar la imagen anterior mientras se investiga.

---

## Fuentes

- [Next.js Blog](https://nextjs.org/blog)
- [ORM releases and maturity levels — Prisma Docs](https://www.prisma.io/docs/orm/v7/more/releases)
- [Prisma's Next Roadmap](https://www.prisma.io/blog/prisma-next-roadmap)
- [`@prisma/dev` pins vulnerable `@hono/node-server` — prisma/prisma#29605](https://github.com/prisma/prisma/issues/29605)
- [npm audit security vulnerabilities — prisma/prisma#29341](https://github.com/prisma/prisma/issues/29341)
- [Prisma Adapter — Auth.js Docs](https://authjs.dev/getting-started/adapters/prisma)
- [`@auth/prisma-adapter` — npm](https://www.npmjs.com/package/@auth/prisma-adapter)
- [How to use Prisma ORM with Auth.js and Next.js](https://www.prisma.io/docs/guides/authentication/authjs/nextjs)
- [next-auth releases — GitHub](https://github.com/nextauthjs/next-auth/releases)
- [How many more years of beta releases for v5? — nextauthjs/next-auth#13382](https://github.com/nextauthjs/next-auth/discussions/13382)
- [prisma/orm Releases — GitHub](https://github.com/prisma/orm/releases)
- Inventario de versiones verificado localmente con `npm list`/`npm view <pkg> version` el 2026-09-10.
