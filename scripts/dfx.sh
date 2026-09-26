#!/usr/bin/env bash
# Run dfx with the Motoko compiler pinned in mops.toml ([toolchain] moc).
# dfx 0.31 ships moc 1.1.x, which cannot compile mo:core >= 2.4.
# mops 3 removed `mops toolchain init` and the moc-wrapper binary. Set
# DFX_MOC_PATH to the compiler from `mops toolchain bin moc`.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v mops >/dev/null 2>&1; then
  echo "mops is required. Install: npm i -g ic-mops" >&2
  exit 1
fi

if [[ ! -f "$ROOT/mops.toml" ]]; then
  echo "mops.toml not found in $ROOT" >&2
  exit 1
fi

# Ensure packages and the pinned moc are installed.
mops install >/dev/null

if [[ -z "${DFX_MOC_PATH:-}" ]]; then
  DFX_MOC_PATH="$(mops toolchain bin moc)"
  export DFX_MOC_PATH
fi

if [[ ! -x "$DFX_MOC_PATH" ]]; then
  echo "Pinned moc is not executable: ${DFX_MOC_PATH}" >&2
  echo "Run: npm run mops:setup" >&2
  exit 1
fi

exec dfx "$@"
