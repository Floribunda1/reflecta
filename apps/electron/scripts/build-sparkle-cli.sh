#!/bin/bash
set -euo pipefail

sparkle_version=2.9.4
script_dir="$(cd "$(dirname "$0")" && pwd)"
app_dir="$(cd "$script_dir/.." && pwd)"
cache_dir="$app_dir/.cache/sparkle-cli"
destination="$cache_dir/sparkle.app"

if [[ -x "$destination/Contents/MacOS/sparkle" && -f "$cache_dir/Sparkle-LICENSE.txt" ]]; then
  exit 0
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Building Sparkle requires the full Xcode installation." >&2
  exit 1
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

git clone --depth 1 --branch "$sparkle_version" \
  https://github.com/sparkle-project/Sparkle.git "$work_dir/Sparkle"
xcodebuild \
  -project "$work_dir/Sparkle/Sparkle.xcodeproj" \
  -scheme sparkle-cli \
  -configuration Release \
  -derivedDataPath "$work_dir/build" \
  ARCHS=arm64 \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO \
  PRODUCT_BUNDLE_IDENTIFIER=com.acnoo.reflecta.sparkle-cli \
  build

mkdir -p "$cache_dir"
ditto "$work_dir/build/Build/Products/Release/sparkle.app" "$destination"
cp "$work_dir/Sparkle/LICENSE" "$cache_dir/Sparkle-LICENSE.txt"
