#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

echo "Installing dependencies..."
# 首先尝试正常安装（会编译 better-sqlite3）
# 如果失败，尝试使用预编译的二进制文件
if ! pnpm install --frozen-lockfile 2>&1; then
    echo "Normal install failed, trying with prebuild..."
    # 清理并重试
    rm -rf node_modules
    pnpm install --frozen-lockfile --ignore-scripts || true
    # 尝试下载预编译的 better-sqlite3
    cd node_modules/better-sqlite3 2>/dev/null && npx prebuild-install || true
    cd "${COZE_WORKSPACE_PATH}"
fi

echo "Building the Next.js project..."
# 设置构建环境变量，避免数据库初始化
export NEXT_PHASE=phase-production-build
export NODE_ENV=production
# 限制并行度，避免CPU占满
export NODE_OPTIONS="--max-old-space-size=2048"
export TURBOPACK_PROFILE=0
# 使用传统 webpack 构建（更稳定，适合资源有限的服务器）
pnpm next build --experimental-webpack

echo "Bundling server with tsup..."
pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify

echo "Build completed successfully!"
