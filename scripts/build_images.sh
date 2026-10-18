#!/usr/bin/env bash
# Build both Retain images for linux/amd64 (Render's platform) on this machine, then push to GHCR.
#   scripts/build_images.sh            build and push, tagged with the current short commit
#   PUSH=0 scripts/build_images.sh     build into the local Docker image store only
#   TAG=abc1234 scripts/build_images.sh
# Pushing needs `gh auth refresh -s write:packages` and
# `gh auth token | docker login ghcr.io -u <github user> --password-stdin` once.
set -euo pipefail

cd "$(dirname "$0")/.."
REGISTRY="${REGISTRY:-ghcr.io/aniruddhasgit}"
TAG="${TAG:-$(git rev-parse --short HEAD)}"
PUSH="${PUSH:-1}"

if [ "$PUSH" = "1" ]; then OUTPUT=--push; else OUTPUT=--load; fi

# API: context is the repo root; the model is trained inside the image.
docker buildx build --platform linux/amd64 $OUTPUT \
  -f api/Dockerfile -t "$REGISTRY/retain-api:$TAG" .
# Web: API_ORIGIN and PROXY_SECRET are runtime env vars, so this image runs anywhere.
docker buildx build --platform linux/amd64 $OUTPUT \
  -t "$REGISTRY/retain-web:$TAG" web

echo "built $REGISTRY/retain-api:$TAG and $REGISTRY/retain-web:$TAG (push=$PUSH)"
