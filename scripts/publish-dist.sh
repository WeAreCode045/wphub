#!/usr/bin/env bash
set -euo pipefail

# Usage:
# Locally: PUBLISH_REPO_URL can be set (defaults to official repo). Run:
#   npm run build -- --outDir build-output && bash scripts/publish-dist.sh
# In CI: set PUBLISH_REPO_TOKEN secret and call this script; it will use the token to push.

REPO_URL="${PUBLISH_REPO_URL:-https://github.com/WeAreCode045/wphub-dist.git}"
BRANCH="${PUBLISH_REPO_BRANCH:-main}"
OUTDIR="${OUTDIR:-build-output}"
# If PUSH_PARENT is true, the script will push the parent repo commit that updates the
# submodule pointer. Default: false
PUSH_PARENT="${PUSH_PARENT:-false}"

echo "Using repo: $REPO_URL on branch: $BRANCH (push parent: $PUSH_PARENT)"

# Ensure build exists
if [ ! -d "$OUTDIR" ]; then
  echo "Building project into $OUTDIR"
  npm run build -- --outDir "$OUTDIR"
fi

# If dist is not configured as a git submodule, add it
if ! git config --file .gitmodules --get-regexp '^submodule\."dist"' >/dev/null 2>&1; then
  echo "Adding git submodule at dist/ -> $REPO_URL"
  # If 'dist' is tracked in the index as a regular path, remove it first
  if git ls-files -s dist >/dev/null 2>&1; then
    MODE=$(git ls-files -s dist | awk '{print $1}') || MODE=""
    if [ "$MODE" != "160000" ]; then
      echo "Found tracked non-submodule 'dist' in index (mode $MODE). Removing from index..."
      git rm -r --cached dist || true
      rm -rf dist || true
    else
      echo "Found 'dist' in index as a submodule entry (mode $MODE). Cleaning working tree entry."
      rm -rf dist || true
    fi
  else
    # Not tracked in index, remove working dir if present
    if [ -d "dist" ]; then
      rm -rf dist
    fi
  fi

  git submodule add "$REPO_URL" dist
  git add .gitmodules dist
  git commit -m "Add dist submodule pointing at $REPO_URL" || echo "No changes to commit for adding submodule"
fi

# Initialize/update submodule and ensure branch
git submodule update --init --remote dist
pushd dist >/dev/null
git fetch origin "$BRANCH" || true
if git show-ref --verify --quiet refs/heads/"$BRANCH"; then
  git checkout "$BRANCH"
else
  git checkout -B "$BRANCH" "origin/$BRANCH" 2>/dev/null || git checkout -B "$BRANCH"
fi

echo "Syncing $OUTDIR/ -> dist/"
rsync -a --delete --exclude .git "$OUTDIR"/ ./

if [ -n "${PUBLISH_REPO_TOKEN-}" ]; then
  git remote set-url origin "https://x-access-token:${PUBLISH_REPO_TOKEN}@$(echo "$REPO_URL" | sed -e 's|https://||')"
fi

git add -A
if git diff-index --quiet HEAD --; then
  echo "No changes to publish in submodule."
else
  PARENT_SHA=$(git -C .. rev-parse --short HEAD || echo "unknown")
  git commit -m "Publish dist from wphub @${PARENT_SHA}"
  git push origin "$BRANCH"
fi

NEW_SHA=$(git rev-parse --short HEAD)
popd >/dev/null

# Update parent repo's submodule pointer
git add dist
git commit -m "Update dist submodule to ${NEW_SHA}" || echo "No parent changes to commit."

if [ "$PUSH_PARENT" = "true" ]; then
  if [ -n "${PUBLISH_REPO_TOKEN-}" ]; then
    # Push parent using token if provided
    REPO_URL_PARENT=$(git remote get-url origin)
    git remote set-url origin "https://x-access-token:${PUBLISH_REPO_TOKEN}@$(echo "$REPO_URL_PARENT" | sed -e 's|https://||')"
  fi
  git push origin HEAD
  echo "Pushed parent repo update."
else
  echo "Parent repo not pushed (PUSH_PARENT is false). Commit updated submodule pointer locally."
fi

echo "Publish complete. dist -> $REPO_URL@$NEW_SHA"
