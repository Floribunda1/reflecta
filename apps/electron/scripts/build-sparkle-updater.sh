#!/bin/bash
set -euo pipefail

sparkle_version=2.9.4
script_dir="$(cd "$(dirname "$0")" && pwd)"
app_dir="$(cd "$script_dir/.." && pwd)"
cache_dir="$app_dir/.cache/sparkle-updater"
destination="$cache_dir/reflecta-updater.app"
native_dir="$app_dir/native/reflecta-updater"
executable="$destination/Contents/MacOS/reflecta-updater"

if [[ -x "$executable" &&
      -f "$cache_dir/Sparkle-LICENSE.txt" &&
      "$executable" -nt "$native_dir/main.m" &&
      "$executable" -nt "$native_dir/Info.plist" &&
      "$executable" -nt "$0" ]]; then
  exit 0
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

archive="$work_dir/Sparkle.tar.xz"
products="$work_dir/Sparkle"
curl -fsSL \
  "https://github.com/sparkle-project/Sparkle/releases/download/$sparkle_version/Sparkle-$sparkle_version.tar.xz" \
  -o "$archive"
mkdir -p "$products"
tar -xf "$archive" -C "$products"

rm -rf "$destination"
mkdir -p "$destination/Contents/MacOS" "$destination/Contents/Frameworks"
cp "$native_dir/Info.plist" "$destination/Contents/Info.plist"
ditto "$products/Sparkle.framework" "$destination/Contents/Frameworks/Sparkle.framework"
xcrun clang \
  -fobjc-arc \
  -fmodules \
  -arch arm64 \
  -mmacosx-version-min=12.0 \
  -F "$products" \
  -framework AppKit \
  -framework Sparkle \
  -Wl,-rpath,@executable_path/../Frameworks \
  "$native_dir/main.m" \
  -o "$executable"

mkdir -p "$cache_dir"
cp "$products/LICENSE" "$cache_dir/Sparkle-LICENSE.txt"
