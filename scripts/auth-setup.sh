#!/bin/bash

# Quick setup script voor Supabase authenticatie

echo "🚀 Supabase Authenticatie Setup"
echo "================================"
echo ""

# Check of .env bestaat
if [ ! -f .env ]; then
    echo "❌ .env file niet gevonden!"
    exit 1
fi

echo "✅ Environment variables gevonden"
echo ""
echo "📋 Setup stappen:"
echo ""
echo "1️⃣  Voer SQL scripts uit in Supabase SQL Editor:"
echo "    https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/sql/new"
echo ""
echo "    A. Auth synchronisatie (VERPLICHT):"
echo "       scripts/sync-auth-users.sql"
echo ""
echo "    B. Storage bucket (voor file uploads):"
echo "       scripts/setup-supabase-storage.sql"
echo ""
echo "    C. RLS policies (optioneel):"
echo "       scripts/setup-rls-policies.sql"
echo ""
echo "2️⃣  Sync bestaande users naar Auth (als je al users hebt):"
echo "    npm run sync-users-to-auth"
echo ""
echo "3️⃣  Configureer Auth Settings in Supabase:"
echo "    https://supabase.com/dashboard/project/ossyxxlplvqakowiwbok/auth/settings"
echo ""
echo "    - Enable Email Confirmations: OFF (voor development)"
echo "    - Site URL: http://localhost:5173"
echo "    - Redirect URLs: http://localhost:5173/**"
echo ""
echo "4️⃣  Maak een admin user aan:"
echo "    npm run create-admin"
echo ""
echo "5️⃣  Start de development server:"
echo "    npm run dev"
echo ""
echo "6️⃣  Test de login op http://localhost:5173/login"
echo ""
echo "📖 Volledige documentatie: AUTH_SETUP.md"
echo ""
