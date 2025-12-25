#!/usr/bin/env bash
set -euo pipefail

echo "Configuring repository to use .githooks as core.hooksPath"
git config core.hooksPath .githooks
chmod +x .githooks/post-commit || true

echo "Git hooks configured (core.hooksPath set to .githooks)."
