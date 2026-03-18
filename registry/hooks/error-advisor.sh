#!/bin/bash
# error-advisor.sh
# PostToolUse hook for Bash events
#
# Provides contextual fix suggestions when Bash commands fail.
# Reads exit code from tool result and prints helpful hints for common failures.
# Does NOT block — only provides advisory feedback on stderr.
#
# Exit codes:
#   0  - always allow (advisory only, never blocks)

set -euo pipefail

INPUT=$(cat)
EXIT_CODE=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_result',{}).get('exit_code',0))" 2>/dev/null || echo "0")
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")

# Only advise on failures
if [ "$EXIT_CODE" = "0" ]; then
  exit 0
fi

# Pattern-based advice
if echo "$COMMAND" | grep -qE '^npm (install|i) '; then
  echo "Hint: npm install failed. Try: rm -rf node_modules && npm install, or check npm ERR! lines above." >&2
elif echo "$COMMAND" | grep -qE 'permission denied|EACCES' ; then
  echo "Hint: Permission denied. Check file ownership or use sudo for system operations." >&2
elif echo "$COMMAND" | grep -qE '^(npx|yarn|pnpm) '; then
  echo "Hint: Package command failed. Ensure dependencies are installed and the package name is correct." >&2
elif echo "$COMMAND" | grep -qE '(command not found|not found)'; then
  echo "Hint: Command not found. Verify the tool is installed and on PATH." >&2
elif echo "$COMMAND" | grep -qE '^(git) '; then
  echo "Hint: Git command failed. Check git status, remote access, and branch state." >&2
fi

exit 0
