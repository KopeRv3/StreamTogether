#!/bin/sh
set -e

# El plan gratuito de Render apaga el contenedor y lo vuelve a levantar.
# Cada arranque aplica las migraciones pendientes, asi que la base siempre
# queda al dia sin pasos manuales.
echo "[arranque] aplicando migraciones..."

# La base puede tardar unos segundos en estar disponible justo despues de
# arrancar el contenedor. Sin reintentos, un hipo de red tumba el deploy.
intentos=0
maximo=10

until npx prisma migrate deploy; do
  intentos=$((intentos + 1))
  if [ "$intentos" -ge "$maximo" ]; then
    echo "[arranque] las migraciones fallaron tras $maximo intentos"
    exit 1
  fi
  echo "[arranque] fallo el intento $intentos, reintentando en 3s..."
  sleep 3
done

echo "[arranque] listo"
exec "$@"