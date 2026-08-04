#!/usr/bin/env bash
#
# Full end-to-end smoke test of the PurelyMail CLI against the REAL API.
#
# Exercises 16 of the 19 v0 operations (reads + user/app-password/password-reset/
# routing lifecycles) using ONLY throwaway `clitest*` resources, which it deletes
# — including on early exit (EXIT trap). It never touches pre-existing
# users/domains/rules. The 3 real-domain-mutating ops (domains add/delete/
# updateSettings) are deliberately excluded so a verified production domain is
# never altered.
#
# This is a MANUAL developer tool, not a CI gate: it needs a live token and a
# verified domain and it mutates the account. The sanctioned CI path is the
# secret-gated, read-only `.github/workflows/live-contract.yml` (COMPLIANCE EX-4).
#
# Usage:
#   pnpm --filter @fablabfortsmith/purelymail-cli build   # ensure the CLI is built
#   scripts/e2e-live.sh <verified-domain>                 # e.g. scripts/e2e-live.sh example.com
#
# The token is read from the env var the configured default profile expects
# (from the CLI config); if unset you are prompted for it MASKED. The token and
# the generated password are only ever passed via env — never argv/history/logs.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${1:-${DOMAIN:-}}"
if [[ -z "$DOMAIN" ]]; then
  echo "usage: $0 <verified-domain>   (or set DOMAIN=...)" >&2
  exit 2
fi

BIN="$REPO/packages/cli/dist/bin.js"
if [[ ! -f "$BIN" ]]; then
  echo "CLI not built. Run: pnpm --filter @fablabfortsmith/purelymail-cli build" >&2
  exit 1
fi
PM=(node "$BIN") # read ops (uses the configured default profile)
PMY=(node "$BIN" -y) # destructive ops (skip the confirmation prompt)

# Token: read the env-var NAME the default profile expects (from the CLI config),
# then prompt masked for its value only if it is not already exported.
CFG="${PURELYMAIL_CONFIG_FILE:-${XDG_CONFIG_HOME:-$HOME/.config}/purelymail/config.toml}"
TOKEN_VAR="$(grep -oP '(?<=tokenEnv = ")[^"]+' "$CFG" 2>/dev/null | head -1)"
TOKEN_VAR="${TOKEN_VAR:-PURELYMAIL_API_TOKEN}"
echo "using profile token env var: \$$TOKEN_VAR"
if [[ -z "${!TOKEN_VAR:-}" ]]; then
  read -rs -p "Token for \$$TOKEN_VAR (hidden): " _tok
  echo
  export "${TOKEN_VAR}=${_tok}"
  unset _tok
fi
if [[ -z "${!TOKEN_VAR:-}" ]]; then
  echo "No token; aborting." >&2
  exit 1
fi

TS="$(date +%s)"
LOCAL="clitest$TS" # no symbols: symbolic subaddressing reroutes clitest-* -> clitest
USER="$LOCAL@$DOMAIN"
ALIAS="clialias$TS"
RESET_TARGET="clitestrecover$TS@$DOMAIN"
TEST_PW="$(openssl rand -hex 12)Aa1!" # strong; has upper/lower/digit/symbol
export TEST_PW
RULE_ID=""
USER_CREATED=0
CHECK_OK=0
LAST_OUT=""
PASS=0
FAIL=0

# jget <field...> : read JSON from stdin, walk keys, print the value.
jget() {
  node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let v=JSON.parse(s);for(const k of process.argv.slice(1))v=v?.[k];console.log(v==null?"":typeof v==="object"?JSON.stringify(v):v)})' "$@"
}

check() { # <name> <cmd...>
  local name="$1"
  shift
  if LAST_OUT="$("$@" 2>&1)"; then
    echo "  PASS  $name"
    PASS=$((PASS + 1))
    CHECK_OK=1
    return 0
  fi
  echo "  FAIL  $name"
  echo "        -> $(printf '%s' "$LAST_OUT" | head -2 | tr '\n' ' ')"
  FAIL=$((FAIL + 1))
  CHECK_OK=0
  return 1
}

assert() { # <name> <needle>  (only meaningful if the preceding check passed)
  if [[ "$CHECK_OK" == 1 ]] && printf '%s' "$LAST_OUT" | grep -qF -- "$2"; then
    echo "  PASS  $1"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $1 (missing: $2)"
    FAIL=$((FAIL + 1))
  fi
}

cleanup() {
  echo
  echo "=== cleanup (throwaway resources) ==="
  if [[ -n "$RULE_ID" ]]; then
    if "${PMY[@]}" routing delete "$RULE_ID" >/dev/null 2>&1; then
      echo "  removed routing rule $RULE_ID"
    else
      echo "  (routing rule $RULE_ID already gone)"
    fi
  fi
  if [[ "$USER_CREATED" == 1 ]]; then
    if "${PMY[@]}" users delete "$USER" >/dev/null 2>&1; then
      echo "  removed user $USER"
    else
      echo "  (user $USER already gone)"
    fi
  fi
  unset "$TOKEN_VAR" TEST_PW 2>/dev/null || true
}
trap cleanup EXIT

echo "=== target: $DOMAIN | throwaway user: $USER ==="

echo "== read surface =="
check "account credit" "${PM[@]}" account credit
check "domains list" "${PM[@]}" domains list
assert "  domain present" "$DOMAIN"
check "domains ownership" "${PM[@]}" domains ownership
check "users list" "${PM[@]}" users list
check "routing list" "${PM[@]}" routing list

echo "== user lifecycle =="
if check "users create" "${PM[@]}" users create "$LOCAL" "$DOMAIN" --password-env TEST_PW --no-welcome-email; then
  USER_CREATED=1
fi
check "users get" "${PM[@]}" users get "$USER"
check "users list (after create)" "${PM[@]}" users list
assert "  new user listed" "$LOCAL"
check "users modify (toggle)" "${PM[@]}" users modify "$USER" --disable-search-indexing

echo "== app password =="
# Capture STDOUT only (the once-shown warning goes to stderr — --json stdout is
# clean JSON), so the value parses cleanly.
if APP_OUT="$("${PM[@]}" --json app-password create "$USER" --name clitest 2>/dev/null)"; then
  echo "  PASS  app-password create"
  PASS=$((PASS + 1))
  APP_PW="$(printf '%s' "$APP_OUT" | jget appPassword)"
  export APP_PW
  if [[ -n "${APP_PW:-}" ]]; then
    check "app-password delete" "${PMY[@]}" app-password delete "$USER" --app-password-env APP_PW
  else
    echo "  FAIL  app-password value not parsed"
    FAIL=$((FAIL + 1))
  fi
  unset APP_PW APP_OUT
else
  echo "  FAIL  app-password create"
  FAIL=$((FAIL + 1))
fi

echo "== password reset method =="
check "password-reset upsert" "${PM[@]}" password-reset upsert "$USER" --type email --target "$RESET_TARGET" --description clitest
check "password-reset list" "${PM[@]}" password-reset list "$USER"
assert "  reset method present" "$RESET_TARGET"
check "password-reset delete" "${PMY[@]}" password-reset delete "$USER" --target "$RESET_TARGET"

echo "== routing rule =="
check "routing create" "${PM[@]}" routing create --domain "$DOMAIN" --match-user "$ALIAS" --target "$USER"
if check "routing list (find id)" "${PM[@]}" --json routing list; then
  RULE_ID="$(printf '%s' "$LAST_OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).rows||[];const m=r.find(x=>x.matchUser===process.argv[1]);console.log(m?m.id:"")})' "$ALIAS")"
  if [[ -n "$RULE_ID" ]]; then
    echo "  PASS  rule id resolved ($RULE_ID)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  rule id not found"
    FAIL=$((FAIL + 1))
  fi
fi
if [[ -n "$RULE_ID" ]]; then
  if check "routing delete" "${PMY[@]}" routing delete "$RULE_ID"; then
    RULE_ID=""
  fi
fi

echo "== delete user =="
if [[ "$USER_CREATED" == 1 ]]; then
  if check "users delete" "${PMY[@]}" users delete "$USER"; then
    USER_CREATED=0
  fi
fi

echo
echo "=== SUMMARY: $PASS passed, $FAIL failed ==="
[[ "$FAIL" == 0 ]]
