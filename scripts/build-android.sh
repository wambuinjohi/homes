#!/bin/bash

echo "🏗️  Building Zira Homes Android APK..."

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm install

# Step 2: Build the web app
echo "🌐 Building web application..."
npm run build

# Step 3: Add Android platform (if not already added)
echo "📱 Adding Android platform..."
npx cap add android || echo "Android platform already exists"

# Step 4: Update Capacitor plugins
echo "🔄 Updating Capacitor plugins..."
npx cap update android

# Step 5: Sync web assets to native project
echo "🔄 Syncing assets..."
npx cap sync android

# Step 6: Open Android Studio
echo "🚀 Opening Android Studio..."
echo "In Android Studio:"
echo "1. Build > Generate Signed Bundle/APK"
echo "2. Choose 'APK' and click Next"
echo "3. Create or use existing keystore"
echo "4. Build release APK"

npx cap open android