#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────
#  Entrypoint del contenedor de la aplicación.
#
#  Bootstrap automático en cada arranque:
#    1. Espera a que la BD esté disponible (max 60s).
#    2. Aplica el schema (prisma db push) — idempotente.
#    3. Ejecuta el seed mínimo (categorías por defecto, settings, etc.).
#    4. Lanza el servidor Node.js.
#
#  El seed sólo crea filas si NO existen ya, así que arrancar de nuevo el
#  contenedor no duplica datos.
# ─────────────────────────────────────────────────────────────────────────
set -e

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL no está configurada. Abortando."
    exit 1
fi

echo "⏳ Esperando a la base de datos..."
ATTEMPTS=0
MAX_ATTEMPTS=30
until npx prisma db execute --schema=./prisma/schema.prisma --stdin <<< "SELECT 1;" >/dev/null 2>&1; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
        echo "❌ Base de datos no disponible tras ${MAX_ATTEMPTS} intentos. Abortando."
        exit 1
    fi
    sleep 2
done
echo "✅ Base de datos accesible."

echo "📦 Sincronizando schema (prisma db push)..."
# --accept-data-loss=false: aborta si la operación destruiría datos.
# En primer arranque la BD está vacía y crea todo; en arranques sucesivos
# el diff es vacío y no hace nada.
npx prisma db push --accept-data-loss=false --skip-generate

echo "🌱 Ejecutando seed inicial (idempotente)..."
node ./scripts/seed-bootstrap.mjs || echo "⚠️  Seed falló (no fatal, continuando)."

echo "🚀 Lanzando servidor..."
exec "$@"
