#!/bin/bash
# SKIDS Screen — One-command standalone APK build
# Usage: ./build-apk.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
APK_NAME="SKIDS-Screen-v3.3.0-debug.apk"

echo "🔧 SKIDS APK Builder"
echo "===================="

# Step 1: Kill any zombie Gradle processes
echo "① Cleaning up old Gradle processes..."
pkill -9 -f GradleDaemon 2>/dev/null || true
sleep 1

# Step 2: Bundle JS into assets (so APK works WITHOUT Metro)
echo "② Bundling JS into APK assets..."
mkdir -p "$SCRIPT_DIR/android/app/src/main/assets"
cd "$MONO_ROOT"
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file apps/mobile/index.js \
  --bundle-output apps/mobile/android/app/src/main/assets/index.android.bundle \
  --assets-dest apps/mobile/android/app/src/main/res/ \
  --reset-cache
echo "   ✅ JS bundle created ($(du -h apps/mobile/android/app/src/main/assets/index.android.bundle | cut -f1))"

# Step 3: Build APK (arm64 only = faster, covers 95% of devices)
echo "③ Building APK (arm64-v8a)..."
cd "$SCRIPT_DIR/android"
./gradlew assembleDebug --no-daemon -PreactNativeArchitectures=arm64-v8a -q

# Step 4: Copy to Desktop
APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
cp "$APK_PATH" "$HOME/Desktop/$APK_NAME"
APK_SIZE=$(du -h "$HOME/Desktop/$APK_NAME" | cut -f1)

echo ""
echo "✅ APK ready: ~/Desktop/$APK_NAME ($APK_SIZE)"
echo "   Install: adb install ~/Desktop/$APK_NAME"
echo "   Or transfer to phone and sideload"
