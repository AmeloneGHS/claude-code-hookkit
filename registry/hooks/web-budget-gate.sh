#!/bin/bash
# web-budget-gate.sh
# PreToolUse hook for WebSearch|WebFetch events
#
# Enforces a per-session cap on web search and fetch calls to control LLM costs.
# Each call increments a counter stored in /tmp. When the counter exceeds the limit,
# further web calls are blocked until the session ends.
#
# Configuration:
#   CLAUDE_HOOKS_WEB_LIMIT — max web calls per session (default: 10)
#
# Counter file: /tmp/claude-code-hookkit-web-count-<session_id>
#
# Claude Code passes JSON via stdin. We extract session_id for tracking.
#
# Exit codes:
#   0  - allow (budget not exceeded)
#   2  - block (budget exceeded, shows reason to Claude)

INPUT=$(cat)

# Extract session_id from JSON using grep/sed (no jq or python3 required)
SESSION_ID=$(printf '%s' "$INPUT" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"session_id"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')

# If no session_id, use a fallback key (shouldn't happen in practice)
if [ -z "$SESSION_ID" ]; then
  SESSION_ID="default"
fi

# Get the web call limit — default 10, overridable via env var
WEB_LIMIT="${CLAUDE_HOOKS_WEB_LIMIT:-10}"

# Counter file path — unique per session
COUNTER_FILE="/tmp/claude-code-hookkit-web-count-${SESSION_ID}"

# Read current count from file (default 0 if file doesn't exist)
if [ -f "$COUNTER_FILE" ]; then
  CURRENT_COUNT=$(cat "$COUNTER_FILE" 2>/dev/null)
  # Sanitize: ensure it's a non-negative integer
  CURRENT_COUNT=$(printf '%s' "$CURRENT_COUNT" | grep -o '^[0-9]*$')
  if [ -z "$CURRENT_COUNT" ]; then
    CURRENT_COUNT=0
  fi
else
  CURRENT_COUNT=0
fi

# Check if the budget is already exhausted BEFORE incrementing
# This prevents off-by-one: the Nth call should be the last allowed, (N+1)th is blocked
if [ "$CURRENT_COUNT" -ge "$WEB_LIMIT" ]; then
  printf 'Web budget exceeded: %d/%d calls used this session. Set CLAUDE_HOOKS_WEB_LIMIT to increase the limit.\n' "$CURRENT_COUNT" "$WEB_LIMIT" >&2
  exit 2
fi

# Increment the counter and write back to the file
NEW_COUNT=$((CURRENT_COUNT + 1))
printf '%d' "$NEW_COUNT" > "$COUNTER_FILE"

# Allow the web call
exit 0
