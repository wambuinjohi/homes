@echo off
echo 🏗️  Building Zira Homes Android APK...

REM Step 1: Install dependencies
echo 📦 Installing dependencies...
call npm install

REM Step 2: Build the web app
echo 🌐 Building web application...
call npm run build

REM Step 3: Add Android platform (if not already added)
echo 📱 Adding Android platform...
call npx cap add android

REM Step 4: Update Capacitor plugins
echo 🔄 Updating Capacitor plugins...
call npx cap update android

REM Step 5: Sync web assets to native project
echo 🔄 Syncing assets...
call npx cap sync android

REM Step 6: Open Android Studio
echo 🚀 Opening Android Studio...
echo In Android Studio:
echo 1. Build ^> Generate Signed Bundle/APK
echo 2. Choose 'APK' and click Next
echo 3. Create or use existing keystore
echo 4. Build release APK

call npx cap open android