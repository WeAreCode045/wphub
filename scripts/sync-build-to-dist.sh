#!/usr/bin/env bash
set -euo pipefail

OUTDIR="${OUTDIR:-build-output}"
BRANCH="${BRANCH:-$(git rev-parse --abbrev-ref HEAD || echo main)}"

if [ ! -d "$OUTDIR" ]; then
  echo "Build output not found; running build into $OUTDIR"
  npm run build -- --outDir "$OUTDIR"
fi

# Ensure dist exists
if [ -d "dist" ] && [ -f "dist/.git" ]; then
  echo "dist exists and is a git dir; removing to allow parent tracking"
  rm -rf dist
fi

mkdir -p dist
rsync -a --delete "$OUTDIR"/ dist/

git add dist
if git diff --staged --quiet; then
  echo "No changes in dist to commit."
  exit 0
fi
PARENT_SHA=$(git rev-parse --short HEAD || echo unknown)

git commit -m "Update dist from build-output @${PARENT_SHA}"

if [ "${PUSH_PARENT:-false}" = "true" ]; then
  git push origin "$BRANCH"
  echo "Pushed parent repo with updated dist."
else
  echo "Committed dist update locally. Set PUSH_PARENT=true to push."
fi
