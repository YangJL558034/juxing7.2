#!/bin/bash
set -Eeuo pipefail

# Create symlink if it doesn't exist
if [ ! -e /workspace/projects ]; then
    ln -s /workspace /workspace/projects
fi

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-/workspace}"
cd "${COZE_WORKSPACE_PATH}"

echo "Starting dev server..."
pnpm tsx watch src/server.ts --dev
