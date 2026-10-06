#!/bin/sh
# Vercel build for loft-server.
#
# Migrations must land on the database the server actually queries. On
# 2026-10-05 the project's DIRECT_URL pointed at a different database than
# DATABASE_URL, so `prisma migrate deploy` migrated one while every request
# read the other, and login broke. So the direct URL is derived from
# DATABASE_URL here instead of trusting DIRECT_URL: Neon's direct host is
# the pooled host without "-pooler".
set -e
: "${DATABASE_URL:?DATABASE_URL must be set}"
DIRECT_URL=$(printf '%s' "$DATABASE_URL" | sed 's/-pooler\././')
export DIRECT_URL
npx prisma migrate deploy
npx prisma generate
