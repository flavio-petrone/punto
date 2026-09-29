#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
exec php -d upload_max_filesize=6M -d post_max_size=7M -d display_errors=0 -S "127.0.0.1:${PUNTO_PORT:-8894}" -t public router.php
