#!/usr/bin/env bash
set -euo pipefail

PORT_DEV=4012
PORT_NPX=4111
SKIP_INSTALL=0
SKIP_MANUAL=0
tmp_dir=""
dev_pid=""
npx_smoke_pid=""
npx_manual_pid=""
pack_file=""
start_ts="$(date +%s)"

if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_GREEN=$'\033[32m'
  C_RED=$'\033[31m'
  C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'
else
  C_RESET=""
  C_BOLD=""
  C_GREEN=""
  C_RED=""
  C_YELLOW=""
  C_BLUE=""
fi

SUMMARY=()
FAILED_STEP=""

for arg in "$@"; do
  case "$arg" in
    --skip-install) SKIP_INSTALL=1 ;;
    --skip-manual|--no-manual) SKIP_MANUAL=1 ;;
    --help|-h)
      cat <<'EOF'
Usage: scripts/release-check.sh [--skip-install] [--skip-manual]

Options:
  --skip-install   Skip `npm ci`
  --skip-manual    Skip interactive manual UI checklist
  --no-manual      Alias for --skip-manual
  --help, -h       Show this help
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $arg"
      echo "Run with --help for usage."
      exit 1
      ;;
  esac
done

# Keep output in plain terminal flow (avoid pager-driven "interactive" views).
export PAGER=cat
export GIT_PAGER=cat
export GH_PAGER=cat

add_summary() {
  local name="$1"
  local status="$2"
  local detail="$3"
  SUMMARY+=("${name}|${status}|${detail}")
}

print_header() {
  printf '\n%s%s%s\n' "$C_BOLD" "Sidequests Release Check" "$C_RESET"
  printf '%s\n' "------------------------------------------------------------------"
}

print_step() {
  local title="$1"
  printf '\n%s[%s]%s %s\n' "$C_BLUE" "STEP" "$C_RESET" "$title"
}

print_cmd() {
  printf '$ %s\n' "$*"
}

print_ok() {
  local message="$1"
  printf '%s[PASS]%s %s\n' "$C_GREEN" "$C_RESET" "$message"
}

print_warn() {
  local message="$1"
  printf '%s[WARN]%s %s\n' "$C_YELLOW" "$C_RESET" "$message"
}

print_fail() {
  local message="$1"
  printf '%s[FAIL]%s %s\n' "$C_RED" "$C_RESET" "$message"
}

wait_for_url() {
  local url="$1"
  local attempts="${2:-60}"
  local delay="${3:-0.5}"
  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

cleanup_pid() {
  local pid="$1"
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true
    wait "$pid" >/dev/null 2>&1 || true
  fi
}

run_check() {
  local name="$1"
  shift
  local t0
  t0="$(date +%s)"
  print_cmd "$@"
  if "$@"; then
    local dt=$(( $(date +%s) - t0 ))
    add_summary "$name" "PASS" "${dt}s"
    print_ok "$name (${dt}s)"
  else
    local rc=$?
    local dt=$(( $(date +%s) - t0 ))
    FAILED_STEP="$name"
    add_summary "$name" "FAIL" "exit ${rc}, ${dt}s"
    print_fail "$name (exit ${rc}, ${dt}s)"
    exit "$rc"
  fi
}

print_summary() {
  local exit_code="$1"
  local total_dt=$(( $(date +%s) - start_ts ))
  printf '\n%s%s%s\n' "$C_BOLD" "Release Check Summary" "$C_RESET"
  printf '%s\n' "------------------------------------------------------------------"
  printf '%-42s %-8s %s\n' "Check" "Result" "Details"
  printf '%s\n' "------------------------------------------------------------------"
  local row
  for row in "${SUMMARY[@]}"; do
    local name status detail
    IFS='|' read -r name status detail <<< "$row"
    printf '%-42s %-8s %s\n' "$name" "$status" "$detail"
  done
  printf '%s\n' "------------------------------------------------------------------"
  if [[ "$exit_code" -eq 0 ]]; then
    printf '%s[PASS]%s All checks completed in %ss\n' "$C_GREEN" "$C_RESET" "$total_dt"
    echo "Ready to commit, push, and publish."
  else
    printf '%s[FAIL]%s Failed at: %s (after %ss)\n' "$C_RED" "$C_RESET" "${FAILED_STEP:-unknown}" "$total_dt"
    if [[ -n "$tmp_dir" ]]; then
      echo "Debug logs kept at: $tmp_dir"
    fi
  fi
}

on_exit() {
  local exit_code="$1"
  cleanup_pid "$dev_pid"
  cleanup_pid "$npx_smoke_pid"
  cleanup_pid "$npx_manual_pid"
  if [[ "$exit_code" -eq 0 ]]; then
    [[ -n "$tmp_dir" ]] && rm -rf "$tmp_dir"
  fi
  print_summary "$exit_code"
}

trap 'on_exit $?' EXIT
trap 'print_fail "Interrupted by user"; FAILED_STEP="Interrupted"; exit 130' INT TERM

if [[ ! -f "package.json" ]]; then
  print_fail "Run this script from the repository root."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  print_fail "curl is required."
  exit 1
fi

if ! command -v tar >/dev/null 2>&1; then
  print_fail "tar is required."
  exit 1
fi

print_header

print_step "Repo diff review"
run_check "Git status" git --no-pager status --short
run_check "Git diff stat" git --no-pager diff --stat

print_step "Automated quality gates"
if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  run_check "npm ci" npm ci
else
  add_summary "npm ci" "SKIP" "--skip-install"
  print_warn "Skipping npm ci (--skip-install)"
fi
run_check "Lint" npm run lint
run_check "Build" npm run build
run_check "Unit tests" npm test
run_check "Integration tests" npm run test:integration
run_check "Privacy gate" npm run check:privacy
run_check "NPX build" npm run build:npx
run_check "Smoke tests" npm run test:smoke:web

tmp_dir="$(mktemp -d)"

print_step "First-run API behavior with fresh data dir"
APP_DATA_DIR="$tmp_dir/dev-data" DATABASE_URL="file:./dev.db" npm run dev -- --hostname 127.0.0.1 --port "$PORT_DEV" >"$tmp_dir/dev.log" 2>&1 &
dev_pid=$!
if ! wait_for_url "http://127.0.0.1:${PORT_DEV}/api/preflight" 80 0.5; then
  add_summary "Dev boot (fresh dir)" "FAIL" "server not ready"
  FAILED_STEP="Dev boot (fresh dir)"
  print_fail "Dev server did not become ready. Tail of log:"
  tail -n 40 "$tmp_dir/dev.log" || true
  exit 1
fi
add_summary "Dev boot (fresh dir)" "PASS" "port ${PORT_DEV}"
print_ok "Dev server ready on ${PORT_DEV}"

status_code="$(curl -sS -o "$tmp_dir/projects.json" -w "%{http_code}" "http://127.0.0.1:${PORT_DEV}/api/projects")"
body="$(cat "$tmp_dir/projects.json")"
echo "GET /api/projects -> HTTP $status_code"
echo "Body: $body"
if [[ "$status_code" != "200" ]]; then
  add_summary "First-run /api/projects" "FAIL" "http ${status_code}"
  FAILED_STEP="First-run /api/projects"
  print_fail "Expected HTTP 200 for /api/projects."
  exit 1
fi
add_summary "First-run /api/projects" "PASS" "http 200"
print_ok "First-run /api/projects returned 200"
cleanup_pid "$dev_pid"
dev_pid=""

print_step "Package contents check"
run_check "npm pack --dry-run" npm pack --dry-run
pack_file="$(npm pack | tail -n 1)"
echo "Pack file: $pack_file"
add_summary "npm pack" "PASS" "$pack_file"
print_ok "Pack file created: $pack_file"

print_cmd tar -tf "$pack_file"
tar -tf "$pack_file"
if tar -tf "$pack_file" | grep -E -q '(^|/)\.env($|\.|/)|(^|/)dev\.db($|/)|(^|/)docs/internal($|/)'; then
  add_summary "Package file audit" "FAIL" "sensitive or internal files found"
  FAILED_STEP="Package file audit"
  print_fail "Potential sensitive/unwanted files detected in package."
  exit 1
fi
add_summary "Package file audit" "PASS" "no sensitive/internal files"
print_ok "Package file audit passed"

print_step "NPX tarball smoke test"
APP_DATA_DIR="$tmp_dir/npx-smoke-data" npx -y "./$pack_file" --no-open --port "$PORT_NPX" >"$tmp_dir/npx-smoke.log" 2>&1 &
npx_smoke_pid=$!
if ! wait_for_url "http://127.0.0.1:${PORT_NPX}/api/preflight" 80 0.5; then
  add_summary "NPX smoke boot" "FAIL" "server not ready"
  FAILED_STEP="NPX smoke boot"
  print_fail "NPX smoke server did not become ready. Tail of log:"
  tail -n 40 "$tmp_dir/npx-smoke.log" || true
  exit 1
fi
add_summary "NPX smoke boot" "PASS" "port ${PORT_NPX}"
print_ok "NPX smoke server ready on ${PORT_NPX}"

status_code="$(curl -sS -o "$tmp_dir/npx-projects.json" -w "%{http_code}" "http://127.0.0.1:${PORT_NPX}/api/projects")"
echo "NPX GET /api/projects -> HTTP $status_code"
if [[ "$status_code" != "200" ]]; then
  add_summary "NPX /api/projects" "FAIL" "http ${status_code}"
  FAILED_STEP="NPX /api/projects"
  print_fail "Expected HTTP 200 from packaged NPX app."
  exit 1
fi
add_summary "NPX /api/projects" "PASS" "http 200"
print_ok "NPX /api/projects returned 200"
cleanup_pid "$npx_smoke_pid"
npx_smoke_pid=""

if [[ "$SKIP_MANUAL" -eq 0 ]] && [[ -t 0 ]]; then
  print_step "Manual UI checklist (interactive)"
  APP_DATA_DIR="$tmp_dir/npx-manual-data" npx -y "./$pack_file" --port "$PORT_NPX" >"$tmp_dir/npx-manual.log" 2>&1 &
  npx_manual_pid=$!
  if ! wait_for_url "http://127.0.0.1:${PORT_NPX}/api/preflight" 80 0.5; then
    add_summary "Manual UI boot" "FAIL" "server not ready"
    FAILED_STEP="Manual UI boot"
    print_fail "Manual UI server did not become ready. Tail of log:"
    tail -n 40 "$tmp_dir/npx-manual.log" || true
    exit 1
  fi
  add_summary "Manual UI boot" "PASS" "port ${PORT_NPX}"
  print_ok "Manual UI server ready on ${PORT_NPX}"
  cat <<EOF

Manual checks:
  [ ] Open http://127.0.0.1:${PORT_NPX}
  [ ] Dashboard loads (full-width scrollable page, empty state is OK on fresh data dir)
  [ ] Click Refresh — projects appear with row-level shimmer (blue scan → mauve enrich → green done)
  [ ] Click a project row — right slide-over panel opens with project details
  [ ] Escape closes the slide-over panel
  [ ] Verify inline GitHub link on project rows (blue "GitHub" text with external link icon)
  [ ] Verify "Last Active" column shows relative times
  [ ] In slide-over: verify Project Overview card (next action, summary, details grid, risks/recs)
  [ ] In slide-over: verify GitHub card (4 metric tiles + blue issue/PR links)
  [ ] In slide-over: verify Timeline card (monospace colored type labels, border separators)
  [ ] Verify stats cards (large text-3xl numbers, rounded-xl cards)
  [ ] Verify filter chips + stats filters work, click "Projects" card to clear all filters
  [ ] Keyboard flow: j/k navigates selection, Escape clears detail selection
  [ ] Open Settings — verify section headings with horizontal rules, system status card with dots, Cancel button
  [ ] Toggle dark/light mode — verify both themes render correctly

Type 'yes' to mark manual checks as passed:
EOF
  read -r manual_answer
  if [[ "$manual_answer" != "yes" ]]; then
    add_summary "Manual UI checklist" "FAIL" "user did not confirm"
    FAILED_STEP="Manual UI checklist"
    print_fail "Manual checks not confirmed. Aborting."
    exit 1
  fi
  add_summary "Manual UI checklist" "PASS" "confirmed by user"
  print_ok "Manual checklist confirmed"
  cleanup_pid "$npx_manual_pid"
  npx_manual_pid=""
else
  add_summary "Manual UI checklist" "SKIP" "--skip-manual or non-interactive"
  print_warn "Skipping manual UI step (--skip-manual or non-interactive shell)."
fi

print_step "Release auth/version checks"
if command -v gh >/dev/null 2>&1; then
  run_check "GitHub auth" gh auth status
else
  add_summary "GitHub auth" "SKIP" "gh not installed"
  print_warn "gh not found; skipping GitHub auth check."
fi
run_check "npm whoami" npm whoami
run_check "npm view current version" npm view @eeshans/sidequests version
run_check "package.json version" node -p "require('./package.json').version"
