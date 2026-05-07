#!/usr/bin/env bash
set -e

ICON_SRC="build/icon.png"
ICONSET="build/icon.iconset"

if [ ! -f "$ICON_SRC" ]; then
  echo "Error: $ICON_SRC not found. Run from repo root." >&2
  exit 1
fi

mkdir -p "$ICONSET"

sips -z 16   16   "$ICON_SRC" --out "$ICONSET/icon_16x16.png"
sips -z 32   32   "$ICON_SRC" --out "$ICONSET/icon_16x16@2x.png"
sips -z 32   32   "$ICON_SRC" --out "$ICONSET/icon_32x32.png"
sips -z 64   64   "$ICON_SRC" --out "$ICONSET/icon_32x32@2x.png"
sips -z 128  128  "$ICON_SRC" --out "$ICONSET/icon_128x128.png"
sips -z 256  256  "$ICON_SRC" --out "$ICONSET/icon_128x128@2x.png"
sips -z 256  256  "$ICON_SRC" --out "$ICONSET/icon_256x256.png"
sips -z 512  512  "$ICON_SRC" --out "$ICONSET/icon_256x256@2x.png"
sips -z 512  512  "$ICON_SRC" --out "$ICONSET/icon_512x512.png"
cp "$ICON_SRC"              "$ICONSET/icon_512x512@2x.png"

iconutil -c icns "$ICONSET" -o build/icon.icns
echo "Built build/icon.icns"
