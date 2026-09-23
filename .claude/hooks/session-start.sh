#!/bin/bash
# Claude Code on the web: install npm and sprite-pipeline dependencies so `npm test`, `npm run format:check` and
# `npm run sprites` work at session start. Chromium comes preinstalled there (PLAYWRIGHT_BROWSERS_PATH).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
npm install --no-audit --no-fund
if [ -z "${PLAYWRIGHT_BROWSERS_PATH:-}" ]; then
  npx playwright install chromium
fi
python3 -m pip install --quiet --disable-pip-version-check --root-user-action=ignore -r tools/sprites/requirements.txt
