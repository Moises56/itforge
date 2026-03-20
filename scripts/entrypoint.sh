#!/bin/sh
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ITForge — Production Startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── 1. Run database migrations ──────────────────────────────────────────────
echo ""
echo "📦 Running database migrations..."

node node_modules/prisma/build/index.js migrate deploy \
  --schema /app/prisma/schema.prisma

echo "✓ Migrations complete"

# ─── 2. Start Next.js application ───────────────────────────────────────────
echo ""
echo "🚀 Starting Next.js (standalone)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exec node server.js
