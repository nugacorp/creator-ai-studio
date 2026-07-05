#!/usr/bin/env bash
# Sync versioned CAS Hermes skills from repo to ~/.hermes/skills/
# Usage: bash scripts/sync-hermes-skills.sh [--dry-run]
set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
elif [[ -n "${1:-}" ]]; then
  echo "Usage: $0 [--dry-run]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$REPO_ROOT/.hermes-skills"
TARGET_DIR="${HERMES_SKILLS_DIR:-$HOME/.hermes/skills}"

# Fail if not run from Creator AI Studio repo
if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Error: $SOURCE_DIR not found." >&2
  echo "Run this script from the Creator AI Studio repository." >&2
  exit 1
fi

if [[ ! -f "$REPO_ROOT/package.json" ]]; then
  echo "Error: package.json missing at repo root." >&2
  exit 1
fi

if ! grep -q '"name"[[:space:]]*:[[:space:]]*"creator-ai-studio"' "$REPO_ROOT/package.json" 2>/dev/null; then
  echo "Error: this does not appear to be the creator-ai-studio repository." >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"

COPIED=()

copy_file() {
  local src="$1"
  local dest="$2"
  local label="$3"
  if [[ ! -f "$src" ]]; then
    echo "Error: missing $src" >&2
    exit 1
  fi
  if $DRY_RUN; then
    echo "[dry-run] would copy: $label"
  else
    mkdir -p "$(dirname "$dest")"
    cp -f "$src" "$dest"
    echo "copied: $label"
  fi
  COPIED+=("$label")
}

# Index
copy_file "$SOURCE_DIR/CAS_SKILLS_INDEX.md" "$TARGET_DIR/CAS_SKILLS_INDEX.md" "CAS_SKILLS_INDEX.md"

# cas-* skills (SKILL.md only — do not touch hub or builtin skills)
shopt -s nullglob
skill_dirs=("$SOURCE_DIR"/cas-*)
shopt -u nullglob

if [[ ${#skill_dirs[@]} -eq 0 ]]; then
  echo "Error: no cas-* skill directories under $SOURCE_DIR" >&2
  exit 1
fi

for skill_path in "${skill_dirs[@]}"; do
  [[ -d "$skill_path" ]] || continue
  skill_name="$(basename "$skill_path")"
  if [[ ! "$skill_name" =~ ^cas- ]]; then
    continue
  fi
  skill_md="$skill_path/SKILL.md"
  if [[ ! -f "$skill_md" ]]; then
    echo "Error: $skill_md is required" >&2
    exit 1
  fi
  dest_dir="$TARGET_DIR/$skill_name"
  copy_file "$skill_md" "$dest_dir/SKILL.md" "$skill_name/SKILL.md"
done

echo ""
if $DRY_RUN; then
  echo "Dry-run complete. Would sync ${#COPIED[@]} item(s) to $TARGET_DIR"
else
  echo "Sync complete. ${#COPIED[@]} item(s) copied to $TARGET_DIR"
  echo "Hub/builtin skills were not modified."
  echo "Start a new Hermes session or /reset to load updated skills."
fi
