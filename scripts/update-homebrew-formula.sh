#!/usr/bin/env bash
# Regenerates homebrew/envvault.rb's version/url/sha256 fields after a CLI
# release. Run this after `.github/workflows/cli-release.yml` has finished
# and published the GitHub Release assets for the given version.
#
# Usage: ./scripts/update-homebrew-formula.sh 0.1.0
#
# Downloads the release assets directly from GitHub (no `gh` CLI required),
# computes their sha256, and rewrites homebrew/envvault.rb. Review the diff,
# then copy the file into your homebrew-envvault tap repo and commit it
# there (this repo only holds the source of truth for the formula content;
# `brew install` needs it to live in a repo literally named
# `homebrew-envvault`, per Homebrew's tap naming convention).
set -euo pipefail

VERSION="${1:?Usage: $0 <version, e.g. 0.1.0>}"
REPO="BharathLakkoju/nvault"
TAG="cli-v${VERSION}"
FORMULA="$(dirname "$0")/../homebrew/envvault.rb"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

declare -A ASSETS=(
  [macos_arm64]="envvault-macos-arm64"
  [macos_x64]="envvault-macos-x64"
  [linux_x64]="envvault-linux-x64"
)

declare -A SHAS

for key in "${!ASSETS[@]}"; do
  asset="${ASSETS[$key]}"
  url="https://github.com/${REPO}/releases/download/${TAG}/${asset}"
  echo "Downloading ${url}"
  curl -sL -o "${TMP_DIR}/${asset}" "$url"
  sha=$(sha256sum "${TMP_DIR}/${asset}" | cut -d' ' -f1)
  SHAS[$key]="$sha"
  echo "  sha256: $sha"
done

python3 - "$FORMULA" "$VERSION" "$TAG" "${SHAS[macos_arm64]}" "${SHAS[macos_x64]}" "${SHAS[linux_x64]}" <<'PYEOF'
import re, sys

formula_path, version, tag, sha_arm64, sha_macos_x64, sha_linux_x64 = sys.argv[1:7]

with open(formula_path) as f:
    content = f.read()

content = re.sub(r'version "[^"]*"', f'version "{version}"', content, count=1)
content = re.sub(
    r'(releases/download/)[^/]+(/envvault-macos-arm64")\n  sha256 "[^"]*"',
    rf'\1{tag}\2\n  sha256 "{sha_arm64}"',
    content,
)
content = re.sub(
    r'(releases/download/)[^/]+(/envvault-macos-x64")\n      sha256 "[^"]*"',
    rf'\1{tag}\2\n      sha256 "{sha_macos_x64}"',
    content,
)
content = re.sub(
    r'(releases/download/)[^/]+(/envvault-linux-x64")\n      sha256 "[^"]*"',
    rf'\1{tag}\2\n      sha256 "{sha_linux_x64}"',
    content,
)

with open(formula_path, "w") as f:
    f.write(content)
PYEOF

echo
echo "Updated $FORMULA for $TAG. Review the diff, then copy it into your homebrew-envvault tap repo."
