#!/bin/sh
set -e

# El plan gratuito de Render apaga el contenedor y lo vuelve a levantar.
# Cada arranque aplica las migraciones pendientes, asi que la base siempre
# queda al dia sin pasos manuales.
echo "[arranque] aplicando migraciones..."
npx prisma migrate deploy

echo "[arranque] listo"
exec "$@"