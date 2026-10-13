#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if [ -x "./runtime/bin/node" ]; then export PATH="$PWD/runtime/bin:$PATH"; fi
if ! command -v node >/dev/null 2>&1; then
  echo 'Please install Node.js 20+ (including npm), then run this launcher again.'
  echo 'Node.js official website: https://nodejs.org/'
  exit 1
fi
exec node studio-launcher.mjs "$@"
