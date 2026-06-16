#!/usr/bin/env bash
#
# Build and launch the app on the iOS Simulator.
#
# Use this instead of `npm run ios` when `expo run:ios` aborts with
# "No code signing certificates are available to use." That happens because the
# app declares the `com.apple.developer.applesignin` entitlement, which makes
# Expo's CLI require a development signing identity even for simulator builds
# (see node_modules/expo/.../run/ios/codeSigning/simulatorCodeSigning.js). When
# no Apple Development certificate exists in the keychain, that check fails.
#
# This script drives xcodebuild directly with *ad-hoc* code signing ("-"), which
# needs no certificate and is accepted by the Simulator. We also supply an
# entitlements file that adds a keychain-access-group; without it the unsigned
# app cannot use the keychain and expo-secure-store fails with
# errSecMissingEntitlement (-34018), which leaves the app stuck on its splash
# during auth bootstrap. Apple Sign In itself still won't work on the Simulator,
# but everything else does.
#
# Honors STYLED_BACKEND_DIR (location of the sibling ../Styled backend) and
# SIM_DEVICE (simulator name, default "iPhone 17").
set -euo pipefail

# CocoaPods chokes without a UTF-8 locale.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$MOBILE_DIR"

APP_BUNDLE_ID="com.ttrypho.Styled-mobile"
SCHEME="Styled"
SIM_DEVICE="${SIM_DEVICE:-iPhone 17}"

log() { printf '\033[1m[run-ios-sim]\033[0m %s\n' "$*"; }

# The main checkout that owns this worktree (parent of the shared .git dir).
MAIN_CHECKOUT="$(cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")" && pwd)"

# Env files are gitignored, so a fresh worktree won't have them. Pull them from
# the main checkout when missing.
for env_file in .env .env.local; do
  if [[ ! -f "$MOBILE_DIR/$env_file" && -f "$MAIN_CHECKOUT/$env_file" ]]; then
    log "Copying $env_file from $MAIN_CHECKOUT"
    cp "$MAIN_CHECKOUT/$env_file" "$MOBILE_DIR/$env_file"
  fi
done

# ensure-local-api.mjs resolves the backend at ../Styled relative to the mobile
# dir, which is wrong inside a worktree. Point it at the real backend.
if [[ -z "${STYLED_BACKEND_DIR:-}" ]]; then
  candidate="$(cd "$MAIN_CHECKOUT/.." && pwd)/Styled"
  [[ -d "$candidate" ]] && export STYLED_BACKEND_DIR="$candidate"
fi
log "Backend dir: ${STYLED_BACKEND_DIR:-<default ../Styled>}"

# Start the local API (and verify EXPO_PUBLIC_API_URL) via the existing script.
node scripts/ensure-local-api.mjs

# Generate the native project and install pods if needed.
if [[ ! -d "$MOBILE_DIR/ios" ]]; then
  log "Generating native iOS project (expo prebuild)"
  npx expo prebuild -p ios
fi
if [[ ! -d "$MOBILE_DIR/ios/Pods" ]]; then
  log "Installing CocoaPods"
  ( cd "$MOBILE_DIR/ios" && pod install )
fi

# Pick a simulator: prefer one already booted, else boot SIM_DEVICE.
DEVICE_ID="$(xcrun simctl list devices booted -j \
  | python3 -c "import json,sys; d=[x for v in json.load(sys.stdin)['devices'].values() for x in v]; print(d[0]['udid'] if d else '')")"
if [[ -z "$DEVICE_ID" ]]; then
  DEVICE_ID="$(xcrun simctl list devices available -j \
    | python3 -c "import json,sys,re; devs=[x for v in json.load(sys.stdin)['devices'].values() for x in v]; m=[x for x in devs if x['name']=='$SIM_DEVICE'] or [x for x in devs if x['name'].startswith('iPhone')]; print(m[0]['udid'] if m else '')")"
  [[ -z "$DEVICE_ID" ]] && { echo "No iOS simulator available" >&2; exit 1; }
  log "Booting simulator $DEVICE_ID"
  xcrun simctl boot "$DEVICE_ID"
fi
open -a Simulator
log "Simulator: $DEVICE_ID"

# Build a simulator entitlements file: the project's entitlements plus a
# keychain-access-group so expo-secure-store can use the keychain under ad-hoc
# signing. The "SIMULATOR" prefix is arbitrary — the Simulator doesn't validate
# the team prefix.
SIM_ENTITLEMENTS="$MOBILE_DIR/ios/build/sim.entitlements"
mkdir -p "$(dirname "$SIM_ENTITLEMENTS")"
PROJECT_ENTITLEMENTS="$MOBILE_DIR/ios/$SCHEME/$SCHEME.entitlements"
if [[ -f "$PROJECT_ENTITLEMENTS" ]]; then
  cp "$PROJECT_ENTITLEMENTS" "$SIM_ENTITLEMENTS"
else
  /usr/libexec/PlistBuddy -c "Save" "$SIM_ENTITLEMENTS" 2>/dev/null || \
    printf '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict/></plist>\n' > "$SIM_ENTITLEMENTS"
fi
APP_ID="SIMULATOR.$APP_BUNDLE_ID"
/usr/libexec/PlistBuddy -c "Delete :application-identifier" "$SIM_ENTITLEMENTS" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :application-identifier string $APP_ID" "$SIM_ENTITLEMENTS"
/usr/libexec/PlistBuddy -c "Delete :keychain-access-groups" "$SIM_ENTITLEMENTS" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :keychain-access-groups array" "$SIM_ENTITLEMENTS"
/usr/libexec/PlistBuddy -c "Add :keychain-access-groups:0 string $APP_ID" "$SIM_ENTITLEMENTS"

# Build for the simulator with ad-hoc signing (no certificate required).
log "Building ($SCHEME, Debug)…"
xcodebuild \
  -workspace "$MOBILE_DIR/ios/$SCHEME.xcworkspace" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -destination "id=$DEVICE_ID" \
  -derivedDataPath "$MOBILE_DIR/ios/build" \
  CODE_SIGN_IDENTITY="-" \
  CODE_SIGN_STYLE=Manual \
  DEVELOPMENT_TEAM="" \
  PROVISIONING_PROFILE_SPECIFIER="" \
  CODE_SIGN_ENTITLEMENTS="$SIM_ENTITLEMENTS" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=YES \
  | { command -v xcbeautify >/dev/null 2>&1 && xcbeautify || cat; }

APP_PATH="$MOBILE_DIR/ios/build/Build/Products/Debug-iphonesimulator/$SCHEME.app"

# Make sure Metro is up before launching so the JS bundle loads.
if ! curl -s -o /dev/null "http://localhost:8081/status"; then
  log "Starting Metro bundler in the background (logs: /tmp/styled-metro.log)"
  ( nohup npm start >/tmp/styled-metro.log 2>&1 & )
  for _ in $(seq 1 20); do
    curl -s -o /dev/null "http://localhost:8081/status" && break
    sleep 1
  done
fi

log "Installing and launching $APP_BUNDLE_ID"
xcrun simctl install "$DEVICE_ID" "$APP_PATH"
xcrun simctl launch "$DEVICE_ID" "$APP_BUNDLE_ID"
log "Done. App is running on the simulator."
