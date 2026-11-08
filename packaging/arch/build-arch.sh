#!/usr/bin/env bash
# Construit forgeoffice-<version>-1-x86_64.pkg.tar.zst dans ./dist (a lancer sous Arch, utilisateur non root).
set -euo pipefail
export REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export FORGEOFFICE_VERSION="${1:?usage: build-arch.sh X.Y.Z}"
export PKGDEST="$REPO_ROOT/dist" BUILDDIR="${BUILDDIR:-/tmp/fo-build}"
mkdir -p "$PKGDEST"
cd "$REPO_ROOT/packaging/arch"
makepkg -f --noconfirm --nodeps
ls -l "$PKGDEST"
