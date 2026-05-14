#!/bin/sh
# POST to the Mecanix API's monthly-statements endpoint.
# Env vars required:
#   API_URL      e.g. https://api-production-9d84.up.railway.app/api/v1
#   CRON_SECRET  matches the API service's CRON_SECRET env var
#
# Exits non-zero on HTTP error so the Railway run shows as failed.

set -eu

: "${API_URL:?API_URL not set}"
: "${CRON_SECRET:?CRON_SECRET not set}"

echo "[$(date -u +%FT%TZ)] POST $API_URL/cron/monthly-statements"

response=$(curl -sS --fail-with-body \
  -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  --max-time 600 \
  "$API_URL/cron/monthly-statements")

echo "$response"
echo "[$(date -u +%FT%TZ)] OK"
