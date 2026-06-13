#!/usr/bin/env bash
set -euo pipefail

CANONICAL_WORKSPACE="${CANONICAL_WORKSPACE:-/root/.openclaw/workspace/chat-app}"
ALIAS_WORKSPACE="${ALIAS_WORKSPACE:-/root/.openclaw/workspace/newchat}"

if [ ! -d "$CANONICAL_WORKSPACE/.git" ]; then
  echo "Canonical workspace is not a git checkout: $CANONICAL_WORKSPACE" >&2
  exit 1
fi

if [ -e "$ALIAS_WORKSPACE" ] && [ ! -L "$ALIAS_WORKSPACE" ]; then
  echo "Alias path exists but is not a symlink: $ALIAS_WORKSPACE" >&2
  echo "Move or remove it manually before creating the deployment alias." >&2
  exit 1
fi

if [ -L "$ALIAS_WORKSPACE" ]; then
  CURRENT_TARGET="$(readlink "$ALIAS_WORKSPACE")"
  if [ "$CURRENT_TARGET" != "$CANONICAL_WORKSPACE" ]; then
    echo "Alias points to $CURRENT_TARGET, expected $CANONICAL_WORKSPACE" >&2
    exit 1
  fi
  echo "Alias already configured: $ALIAS_WORKSPACE -> $CANONICAL_WORKSPACE"
  exit 0
fi

ln -s "$CANONICAL_WORKSPACE" "$ALIAS_WORKSPACE"
echo "Created alias: $ALIAS_WORKSPACE -> $CANONICAL_WORKSPACE"
