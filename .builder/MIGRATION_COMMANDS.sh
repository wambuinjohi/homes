#!/bin/bash

# Supabase Migration - Complete CLI Commands
# From: kdpqimetajnhcqseajok → To: tbmzwmgsvshfdxdoyrcr
# Run these commands in order to complete the migration

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Supabase Migration - Complete Execution${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Configuration
OLD_PROJECT="kdpqimetajnhcqseajok"
NEW_PROJECT="tbmzwmgsvshfdxdoyrcr"

# Phase 2: Schema & Functions Deployment
echo -e "${BLUE}PHASE 2: Schema & Functions Deployment${NC}"
echo ""

echo -e "${GREEN}Step 1: Pull schema from old project${NC}"
echo "Command: supabase link --project-ref $OLD_PROJECT"
supabase link --project-ref "$OLD_PROJECT" || echo "Already linked or error - continuing..."

echo "Command: supabase db pull"
supabase db pull
echo -e "${GREEN}✓ Schema pulled${NC}"
echo ""

echo -e "${GREEN}Step 2: Link to new project${NC}"
echo "Command: supabase link --project-ref $NEW_PROJECT --force-db-link"
supabase link --project-ref "$NEW_PROJECT" --force-db-link
echo -e "${GREEN}✓ Linked to new project${NC}"
echo ""

echo -e "${GREEN}Step 3: Push schema to new project${NC}"
echo "Command: supabase db push"
supabase db push
echo -e "${GREEN}✓ Schema pushed${NC}"
echo ""

echo -e "${GREEN}Step 4: Deploy all edge functions${NC}"
echo "Command: supabase functions deploy"
supabase functions deploy
echo -e "${GREEN}✓ Functions deployed${NC}"
echo ""

echo -e "${GREEN}Step 5: Enable PostgreSQL extensions${NC}"
echo "Creating pg_cron extension..."
supabase db execute --project-ref "$NEW_PROJECT" "CREATE EXTENSION IF NOT EXISTS pg_cron;"
echo "Creating pg_net extension..."
supabase db execute --project-ref "$NEW_PROJECT" "CREATE EXTENSION IF NOT EXISTS pg_net;"
echo -e "${GREEN}✓ Extensions enabled${NC}"
echo ""

echo -e "${GREEN}Step 6: Verify deployment${NC}"
echo "Listing deployed functions..."
supabase functions list --project-ref "$NEW_PROJECT"
echo ""

# Phase 3: Webhook Updates
echo -e "${BLUE}PHASE 3: Update External Webhooks${NC}"
echo ""
echo "⚠️  Manual steps required in external dashboards:"
echo ""
echo "1. Jenga Pay Dashboard:"
echo "   URL: https://v3.jengahq.io/dashboard/settings/create-ipn"
echo "   Old: https://$OLD_PROJECT.supabase.co/functions/v1/jenga-ipn-callback"
echo "   New: https://$NEW_PROJECT.supabase.co/functions/v1/jenga-ipn-callback"
echo ""
echo "2. KCB Buni Developer Portal:"
echo "   Old: https://$OLD_PROJECT.supabase.co/functions/v1/kcb-ipn-callback"
echo "   New: https://$NEW_PROJECT.supabase.co/functions/v1/kcb-ipn-callback"
echo ""
echo "3. M-Pesa Business Portal (if configured):"
echo "   Old: https://$OLD_PROJECT.supabase.co/functions/v1/mpesa-callback"
echo "   New: https://$NEW_PROJECT.supabase.co/functions/v1/mpesa-callback"
echo ""
echo "4. Kopokopo API Settings (if configured):"
echo "   Old: https://$OLD_PROJECT.supabase.co/functions/v1/kopokopo-callback"
echo "   New: https://$NEW_PROJECT.supabase.co/functions/v1/kopokopo-callback"
echo ""
echo -e "${GREEN}✓ Manual webhook updates required${NC}"
echo ""

# Phase 4: Testing
echo -e "${BLUE}PHASE 4: Testing${NC}"
echo ""
echo "Local testing:"
echo "1. npm run dev"
echo "2. Test authentication: login and check browser storage"
echo "3. Verify token: sb-$NEW_PROJECT-auth-token (should be present)"
echo "4. Test API: Open console and run:"
echo "   import { supabase } from '@/integrations/supabase/client';"
echo "   supabase.from('profiles').select('id').limit(1)"
echo ""

# Phase 5: Production
echo -e "${BLUE}PHASE 5: Production Deployment${NC}"
echo ""
echo "Production deployment:"
echo "1. npm run build"
echo "2. npm run preview (test build locally)"
echo "3. git push origin main (deploy via CI/CD)"
echo "4. Monitor: supabase logs --project-ref $NEW_PROJECT --follow"
echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Migration CLI sequence prepared${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Status:"
echo "  ✅ Phase 1: Code changes COMPLETE"
echo "  ⏳ Phase 2: Schema & functions - RUN THE COMMANDS ABOVE"
echo "  ⏳ Phase 3: Webhooks - Manual updates required"
echo "  ⏳ Phase 4: Testing - Local verification"
echo "  ⏳ Phase 5: Production - Deploy when ready"
echo ""
echo "Next: Run 'bash .builder/MIGRATION_COMMANDS.sh' or follow Phase 2 manually"
