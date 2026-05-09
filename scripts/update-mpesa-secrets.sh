#!/bin/bash

# Script to update Supabase Function Secrets from .env file
# This script reads M-Pesa credentials from .env and sets them in Supabase

set -e

echo "🔐 Updating Supabase Function Secrets for M-Pesa..."

# Load environment variables from .env
if [ ! -f .env ]; then
  echo "❌ .env file not found!"
  exit 1
fi

# Source the .env file
source .env

# Validate that all required M-Pesa variables are set
required_vars=(
  "MPESA_CONSUMER_KEY"
  "MPESA_CONSUMER_SECRET"
  "MPESA_SHORTCODE"
  "MPESA_PASSKEY"
  "MPESA_ENVIRONMENT"
)

echo "✅ Checking required environment variables..."
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Missing required variable: $var"
    exit 1
  fi
  echo "  ✓ $var is set"
done

echo ""
echo "📤 Setting Supabase Function Secrets..."
echo ""

# Set each secret using supabase CLI
supabase secrets set MPESA_CONSUMER_KEY="$MPESA_CONSUMER_KEY"
echo "✅ MPESA_CONSUMER_KEY set"

supabase secrets set MPESA_CONSUMER_SECRET="$MPESA_CONSUMER_SECRET"
echo "✅ MPESA_CONSUMER_SECRET set"

supabase secrets set MPESA_SHORTCODE="$MPESA_SHORTCODE"
echo "✅ MPESA_SHORTCODE set"

supabase secrets set MPESA_PASSKEY="$MPESA_PASSKEY"
echo "✅ MPESA_PASSKEY set"

supabase secrets set MPESA_ENVIRONMENT="$MPESA_ENVIRONMENT"
echo "✅ MPESA_ENVIRONMENT set"

echo ""
echo "✨ All M-Pesa secrets updated successfully!"
echo ""
echo "🚀 To deploy the changes, run:"
echo "   supabase functions deploy mpesa-stk-push"
echo "   supabase functions deploy mpesa-callback"
