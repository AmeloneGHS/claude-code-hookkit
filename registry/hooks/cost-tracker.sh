#!/bin/bash
# cost-tracker.sh
# PostToolUse hook (no matcher — runs for all tools)
#
# Appends a log entry for every tool call to a per-session log file.
# This creates a usage audit trail useful for understanding which tools
# Claude is calling most frequently and estimating session costs.
#
# Log file: /tmp/claude-code-hookkit-cost-<session_id>.log
# Log format: timestamp|tool_name
#
# Claude Code passes JSON via stdin. We extract tool_name and session_id.
#
# Exit codes:
#   0  - always allow (this hook never blocks)

INPUT=$(cat)

# Extract session_id from JSON using grep/sed (no jq or python3 required)
SESSION_ID=$(printf '%s' "$INPUT" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"session_id"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')

# Extract tool_name from JSON
TOOL_NAME=$(printf '%s' "$INPUT" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"tool_name"[[:space:]]*:[[:space:]]*"\(.*\)"/\1/')

# Fallbacks for missing fields
if [ -z "$SESSION_ID" ]; then
  SESSION_ID="default"
fi

if [ -z "$TOOL_NAME" ]; then
  TOOL_NAME="unknown"
fi

# Get current UTC timestamp in ISO 8601 format (POSIX date compatible)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date +"%Y-%m-%dT%H:%M:%SZ")

# Log file path — unique per session
LOG_FILE="/tmp/claude-code-hookkit-cost-${SESSION_ID}.log"

# Append log entry: timestamp|tool_name
printf '%s|%s\n' "$TIMESTAMP" "$TOOL_NAME" >> "$LOG_FILE"

# Always exit 0 — this hook logs, it does not block
exit 0
