#!/usr/bin/env bash
# Query the Sentry REST API using SENTRY_AUTH_TOKEN from .env.
#
#   ./scripts/sentry.sh orgs                 list orgs this token can see
#   ./scripts/sentry.sh projects             list projects in the org
#   ./scripts/sentry.sh issues [period]      unresolved issues (default 24h)
#   ./scripts/sentry.sh issue <id>           one issue's detail
#   ./scripts/sentry.sh latest <id>          latest event for an issue (stack trace)
#   ./scripts/sentry.sh raw <path>           any API path, e.g. /organizations/
#
# The token is read from .env and never printed.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "error: no .env in $(pwd)" >&2
  exit 1
fi

# Pull only the keys we need, tolerating quotes and 'export ' prefixes.
read_env() {
  sed -nE "s/^[[:space:]]*(export[[:space:]]+)?$1=[\"']?([^\"']*)[\"']?[[:space:]]*$/\2/p" .env | tail -1
}

TOKEN="$(read_env SENTRY_AUTH_TOKEN)"
ORG="$(read_env SENTRY_ORG)"
PROJECT="$(read_env SENTRY_PROJECT)"

if [ -z "$TOKEN" ]; then
  cat >&2 <<'EOF'
error: SENTRY_AUTH_TOKEN is not set in .env

Create one at https://sentry.io/settings/account/api/auth-tokens/
with scopes: org:read, project:read, event:read
then add to .env:  SENTRY_AUTH_TOKEN=sntryu_...
EOF
  exit 1
fi

API="https://us.sentry.io/api/0"

api() {
  local path="$1"
  local code body tmp
  tmp="$(mktemp)"
  code="$(curl -sS -o "$tmp" -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    "$API$path")"
  body="$(cat "$tmp")"; rm -f "$tmp"

  case "$code" in
    2*) printf '%s' "$body" ;;
    401) echo "error: 401 unauthorized - token is invalid, expired, or revoked" >&2; exit 1 ;;
    403) echo "error: 403 forbidden - token lacks a required scope (need org:read, project:read, event:read)" >&2; exit 1 ;;
    404) echo "error: 404 not found - check the org/project slug: $path" >&2; exit 1 ;;
    429) echo "error: 429 rate limited - wait and retry" >&2; exit 1 ;;
    *)   echo "error: HTTP $code from $path" >&2; printf '%s\n' "$body" >&2; exit 1 ;;
  esac
}

need_org() {
  if [ -z "$ORG" ]; then
    cat >&2 <<'EOF'
error: SENTRY_ORG is not set in .env

Run:  ./scripts/sentry.sh orgs
and add the slug to .env:  SENTRY_ORG=your-org-slug
EOF
    exit 1
  fi
}

need_project() {
  need_org
  if [ -z "$PROJECT" ]; then
    cat >&2 <<'EOF'
error: SENTRY_PROJECT is not set in .env

Run:  ./scripts/sentry.sh projects
and add the slug to .env:  SENTRY_PROJECT=styled-mobile
EOF
    exit 1
  fi
}

fmt() { if command -v jq >/dev/null 2>&1; then jq "$@"; else cat; fi; }

cmd="${1:-issues}"
case "$cmd" in
  orgs)
    api "/organizations/" | fmt -r '.[] | "\(.slug)\t\(.name)"'
    ;;
  projects)
    need_org
    api "/organizations/$ORG/projects/" | fmt -r '.[] | "\(.slug)\t\(.platform // "-")"'
    ;;
  issues)
    need_project
    period="${2:-24h}"
    api "/projects/$ORG/$PROJECT/issues/?query=is:unresolved&statsPeriod=$period&limit=25" \
      | fmt -r '.[] | "\(.shortId)\t[\(.count)x, \(.userCount) users]\t\(.title)\n\tlast: \(.lastSeen)\tid: \(.id)"'
    ;;
  issue)
    [ $# -ge 2 ] || { echo "usage: $0 issue <issue-id>" >&2; exit 1; }
    api "/issues/$2/" | fmt '{shortId, title, culprit, count, userCount, firstSeen, lastSeen, permalink}'
    ;;
  latest)
    [ $# -ge 2 ] || { echo "usage: $0 latest <issue-id>" >&2; exit 1; }
    api "/issues/$2/events/latest/" \
      | fmt '{eventID, dateCreated, message, tags: [.tags[]? | {(.key): .value}], entries: [.entries[]? | select(.type=="exception")]}'
    ;;
  raw)
    [ $# -ge 2 ] || { echo "usage: $0 raw <api-path>" >&2; exit 1; }
    api "$2" | fmt .
    ;;
  *)
    sed -n '3,15p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
