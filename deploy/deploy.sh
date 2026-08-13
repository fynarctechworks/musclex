#!/usr/bin/env bash
# MuscleX VPS deploy: fresh-clone master, build images, (re)start the stack.
# Run from /opt/musclex/deploy on the VPS.
set -euo pipefail

ROOT=/opt/musclex
REPO_DIR="$ROOT/repo"
DEPLOY_DIR="$ROOT/deploy"
BRANCH="${BRANCH:-master}"
REPO_URL="git@github.com:fynarctechworks/musclex.git"

export GIT_SSH_COMMAND="ssh -i /root/.ssh/musclex_github_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

echo "==> Fresh clone of $BRANCH"
rm -rf "$REPO_DIR"
git clone --depth 1 -b "$BRANCH" "$REPO_URL" "$REPO_DIR"
echo "    commit: $(git -C "$REPO_DIR" rev-parse --short HEAD)"

echo "==> Placing production Dockerfiles into source tree"
cp "$DEPLOY_DIR/backend.Dockerfile" "$REPO_DIR/backend/Dockerfile"
cp "$DEPLOY_DIR/scc.Dockerfile"     "$REPO_DIR/saas-control-center/Dockerfile"

echo "==> Building + starting containers"
cd "$DEPLOY_DIR"
docker compose up -d --build

echo "==> Status"
docker compose ps
echo "==> Done. Local health checks:"
echo "    core: curl -s http://127.0.0.1:4100/health"
echo "    scc : curl -s http://127.0.0.1:4101/api/v1/health"
