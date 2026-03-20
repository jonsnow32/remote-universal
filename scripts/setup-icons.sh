#!/usr/bin/env bash
# setup-icons.sh — Distribute the app icon to all apps in the monorepo.
#
# Usage:
#   ./scripts/setup-icons.sh <path-to-icon.png>
#
# The source image should be at least 1024×1024 px (square PNG).
# Requires: sips (built-in macOS) for resizing.

set -euo pipefail

SOURCE="${1:-}"
if [[ -z "$SOURCE" ]]; then
  echo "Usage: $0 <path-to-icon.png>"
  exit 1
fi

if [[ ! -f "$SOURCE" ]]; then
  echo "Error: file not found — $SOURCE"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ─── Apps ────────────────────────────────────────────────────────────────────
APPS=(
  "apps/remote-universal"
  "apps/remote-daikin"
  "apps/remote-lg"
  "apps/remote-samsung"
)

# ─── Helpers ─────────────────────────────────────────────────────────────────
resize() {
  local size="$1" src="$2" dst="$3"
  sips -z "$size" "$size" "$src" --out "$dst" > /dev/null
  echo "  ✓ ${size}×${size} → $dst"
}

# ─── 1. Copy icon.png + adaptive-icon.png to every app's assets/ ─────────────
for APP in "${APPS[@]}"; do
  DIR="$REPO_ROOT/$APP/assets"
  mkdir -p "$DIR"
  cp "$SOURCE" "$DIR/icon.png"
  echo "Copied icon.png → $APP/assets/"

  # adaptive-icon: pad the source to 108 % of the asset (safe zone) –
  # here we just copy the same image; designers can customise separately.
  cp "$SOURCE" "$DIR/adaptive-icon.png"
  echo "Copied adaptive-icon.png → $APP/assets/"
done

# ─── 2. Regenerate native icons for remote-universal ─────────────────────────
UNIVERSAL="$REPO_ROOT/apps/remote-universal"

echo ""
echo "Generating Android mipmap icons …"

# Parallel arrays — compatible with bash 3.2 (macOS default)
MIPMAP_DIRS=(mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi)
MIPMAP_PX=(48 72 96 144 192)

RES_DIR="$UNIVERSAL/android/app/src/main/res"

for i in "${!MIPMAP_DIRS[@]}"; do
  MIPMAP="${MIPMAP_DIRS[$i]}"
  SIZE="${MIPMAP_PX[$i]}"
  DIR="$RES_DIR/$MIPMAP"
  mkdir -p "$DIR"

  # Remove old webp launchers if present
  rm -f "$DIR/ic_launcher.webp" "$DIR/ic_launcher_round.webp"

  resize "$SIZE" "$SOURCE" "$DIR/ic_launcher.png"
  # Round icon = same image (circular clipping is applied at runtime by Android)
  cp "$DIR/ic_launcher.png" "$DIR/ic_launcher_round.png"
done

echo ""
echo "Generating iOS AppIcon (1024×1024) …"

IOS_ICONSET="$UNIVERSAL/ios/UniversalRemote/Images.xcassets/AppIcon.appiconset"
mkdir -p "$IOS_ICONSET"
resize 1024 "$SOURCE" "$IOS_ICONSET/App-Icon-1024x1024@1x.png"

# Ensure Contents.json is present (Xcode requirement)
cat > "$IOS_ICONSET/Contents.json" << 'EOF'
{
  "images": [
    {
      "filename": "App-Icon-1024x1024@1x.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "1024x1024"
    }
  ],
  "info": {
    "version": 1,
    "author": "expo"
  }
}
EOF
echo "  ✓ iOS AppIcon updated"

echo ""
echo "Done! All app icons have been updated."
echo ""
echo "Next steps:"
echo "  • For remote-daikin / remote-lg / remote-samsung:"
echo "      cd apps/remote-<name> && npx expo prebuild"
echo "  • For remote-universal the native files are already in place."
echo "    Rebuild the app with: cd apps/remote-universal && npx expo run:android / run:ios"
