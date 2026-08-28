#!/usr/bin/env bash
# Builds aws-bot/build/lambda-package.zip for Terraform to deploy.
#
# Cross-compiles for the Lambda's actual runtime platform, NOT the platform
# this script runs on — critical from an Apple Silicon Mac, whose wheels
# (pydantic-core etc.) don't run on Lambda. See aws-bot/README.md footguns.
#
# Usage: ./build-lambda-package.sh [arm64|x86_64]
#   Must match terraform/main.tf's aws_lambda_function.architectures.

set -euo pipefail

ARCH="${1:-arm64}"
case "$ARCH" in
  arm64)   PLATFORM="aarch64-manylinux2014" ;;
  x86_64)  PLATFORM="x86_64-manylinux2014" ;;
  *) echo "Usage: $0 [arm64|x86_64]" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT/server"
BUILD_DIR="$ROOT/build"
PKG_DIR="$BUILD_DIR/package"

rm -rf "$BUILD_DIR"
mkdir -p "$PKG_DIR"

uv export --project "$SERVER_DIR" --no-dev --no-hashes --frozen -o "$BUILD_DIR/requirements.txt"

uv pip install \
  --python 3.12 \
  --target "$PKG_DIR" \
  --python-platform "$PLATFORM" \
  --only-binary=:all: \
  -r "$BUILD_DIR/requirements.txt"

cp -r "$SERVER_DIR/app" "$PKG_DIR/"
cp "$SERVER_DIR/handler.py" "$PKG_DIR/"

(cd "$PKG_DIR" && zip -r -q "$BUILD_DIR/lambda-package.zip" .)

echo "Built $BUILD_DIR/lambda-package.zip for $ARCH ($PLATFORM)"
