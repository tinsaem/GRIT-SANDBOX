#!/bin/bash
set -e

# Post-merge setup: install deps + apply migrations (idempotent, non-interactive)
npm run setup
npm run migrate:deploy
