#!/bin/sh
set -e
cd /usr/src/app
npm install
exec "$@"
