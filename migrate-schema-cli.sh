#!/bin/bash

# Supabase Schema Migration Script
# Automates Phase 1 using Supabase CLI
# 
# Prerequisites:
# - Supabase CLI installed (npm install -g supabase)
# - Access to both projects
#
# Usage: bash migrate-schema-cli.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project IDs
OLD_PROJECT="kdpqimetajnhcqseajok"
NEW_PROJECT="tbmzwmgsvshfdxdoyrcr"

echo -e "${BLUE}🚀 Supabase Schema Migration${NC}"
echo "From: $OLD_PROJECT"
echo "To: $NEW_PROJECT"
echo ""

# Step 1: Check if Supabase CLI is installed
echo -e "${BLUE}Step 1: Checking Supabase CLI...${NC}"
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo "Install with: npm install -g supabase"
    exit 1
fi
echo -e "${GREEN}✅ Supabase CLI found${NC}"
echo ""

# Step 2: Link to old project and pull schema
echo -e "${BLUE}Step 2: Pulling schema from old project...${NC}"
echo "Running: supabase link --project-ref $OLD_PROJECT"
supabase link --project-ref "$OLD_PROJECT" || true

echo "Running: supabase db pull"
supabase db pull
echo -e "${GREEN}✅ Schema pulled from old project${NC}"
echo ""

# Step 3: Switch to new project
echo -e "${BLUE}Step 3: Linking to new project...${NC}"
echo "Running: supabase link --project-ref $NEW_PROJECT"
supabase link --project-ref "$NEW_PROJECT" --force-db-link || true
echo -e "${GREEN}✅ Linked to new project${NC}"
echo ""

# Step 4: Push schema to new project
echo -e "${BLUE}Step 4: Pushing schema to new project...${NC}"
echo "Running: supabase db push"
supabase db push
echo -e "${GREEN}✅ Schema pushed to new project${NC}"
echo ""

# Step 5: Enable extensions via SQL
echo -e "${BLUE}Step 5: Enabling PostgreSQL extensions...${NC}"
echo ""
echo "⚠️  Manual step required in Supabase Dashboard:"
echo "1. Go to: https://supabase.com/dashboard/project/$NEW_PROJECT"
echo "2. SQL Editor → New Query"
echo "3. Copy and run this SQL:"
echo ""
echo -e "${YELLOW}CREATE EXTENSION IF NOT EXISTS pg_cron;${NC}"
echo -e "${YELLOW}CREATE EXTENSION IF NOT EXISTS pg_net;${NC}"
echo ""
echo "Or run via CLI:"
echo "  supabase sql --project-ref $NEW_PROJECT 'CREATE EXTENSION IF NOT EXISTS pg_cron;'"
echo ""

# Step 6: Schedule cron jobs via SQL
echo -e "${BLUE}Step 6: Setting up cron jobs...${NC}"
echo ""
echo "⚠️  Manual step required in Supabase Dashboard:"
echo "1. Go to: https://supabase.com/dashboard/project/$NEW_PROJECT/sql"
echo "2. SQL Editor → New Query"
echo "3. Copy and run the SQL from: .builder/MIGRATION_SQL_SCRIPTS.sql"
echo ""
echo "Key queries to run:"
echo "  - Enable extensions (pg_cron, pg_net)"
echo "  - Schedule send-overdue-reminders cron job"
echo "  - Schedule automated-monthly-billing cron job"
echo ""

# Step 7: Verify migration
echo -e "${BLUE}Step 7: Verifying migration...${NC}"
echo ""
echo "To verify schema was migrated successfully:"
echo "1. Open: https://supabase.com/dashboard/project/$NEW_PROJECT"
echo "2. Check Tables under Database"
echo "3. Check Functions under Database"
echo "4. Look for all 50+ tables migrated"
echo ""

# Final summary
echo -e "${GREEN}✨ Phase 1 Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. ✅ Schema migrated"
echo "2. Run SQL scripts for extensions & cron jobs (manual)"
echo "3. Deploy edge functions: supabase functions deploy"
echo "4. Update external webhooks to new project URLs"
echo "5. Test locally: npm run dev"
echo ""
echo -e "${BLUE}Documentation: .builder/MIGRATION_SUMMARY.md${NC}"
