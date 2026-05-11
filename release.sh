#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?usage: ./release.sh <version>}"

npm version "$VERSION" --no-git-tag-version

git add package.json package-lock.json
git commit -m "chore: release v${VERSION}"
git tag "v${VERSION}"

echo "Done. Push with: git push && git push --tags"
