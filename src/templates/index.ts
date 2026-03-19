/**
 * Template registry — bash script templates per event type.
 *
 * Scripts use grep/sed for JSON parsing (pure bash, no external JSON parser required), bash 3.2+ compatible.
 * Each template takes (event, name, matcher?) and returns a bash script string.
 */

const SUPPORTED_EVENTS = ['PreToolUse', 'PostToolUse', 'SessionStart', 'Stop'] as const;
export type TemplateEvent = (typeof SUPPORTED_EVENTS)[number];

/** Return the list of event types that have dedicated templates. */
export function listTemplateEvents(): string[] {
  return [...SUPPORTED_EVENTS];
}

/**
 * Return a bash script template for the given event type.
 *
 * @param event - Hook event type (e.g. "PreToolUse")
 * @param name  - Hook name used in the header comment
 * @param matcher - Optional tool matcher pattern (e.g. "Bash", "Edit|Write")
 * @returns Bash script string ready to be written to disk
 */
export function getTemplate(event: string, name: string, matcher?: string): string {
  switch (event) {
    case 'PreToolUse':
      return preToolUseTemplate(name, matcher);
    case 'PostToolUse':
      return postToolUseTemplate(name, matcher);
    case 'SessionStart':
      return sessionStartTemplate(name);
    case 'Stop':
      return stopTemplate(name);
    default:
      return genericTemplate(name, event);
  }
}

// ---------------------------------------------------------------------------
// Template implementations
// ---------------------------------------------------------------------------

function preToolUseTemplate(name: string, matcher?: string): string {
  const matcherLine = matcher ? `# Matcher: ${matcher}` : '# Matcher: (all tools)';
  return `#!/usr/bin/env bash
# ${name} — PreToolUse hook
${matcherLine}
# Created by claude-code-hookkit create
#
# PreToolUse hooks can block tool execution:
#   exit 0  → allow the tool to run
#   exit 2  → block the tool (stderr is shown to Claude as feedback)
set -euo pipefail

# Read JSON input from stdin
INPUT=$(cat)

# Extract fields using grep (pure bash, no external JSON parser required)
TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name":"[^"]*"' | head -1 | cut -d'"' -f4)
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | cut -d'"' -f4)
COMMAND=$(echo "$INPUT" | grep -o '"command":"[^"]*"' | head -1 | cut -d'"' -f4)

# TODO: Add your blocking logic here
# Example: block if file_path matches a sensitive pattern
# if echo "$FILE_PATH" | grep -qE '\\.env|\\.secret|credentials'; then
#   echo "BLOCKED: Sensitive file access denied" >&2
#   exit 2
# fi

# Allow by default
exit 0
`;
}

function postToolUseTemplate(name: string, matcher?: string): string {
  const matcherLine = matcher ? `# Matcher: ${matcher}` : '# Matcher: (all tools)';
  return `#!/usr/bin/env bash
# ${name} — PostToolUse hook
${matcherLine}
# Created by claude-code-hookkit create
#
# PostToolUse hooks are informational — they should always exit 0.
# They run after the tool has already executed.
set -euo pipefail

# Read JSON input from stdin
INPUT=$(cat)

# Extract fields using grep (pure bash, no external JSON parser required, bash 3.2+ compatible)
TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name":"[^"]*"' | head -1 | cut -d'"' -f4)
TOOL_RESPONSE=$(echo "$INPUT" | grep -o '"tool_response":"[^"]*"' | head -1 | cut -d'"' -f4)

# TODO: Add your post-tool logic here (informational only)
# Example: log tool invocations, trigger notifications, update metrics
# echo "[$TOOL_NAME] completed" >> /tmp/tool-log.txt

# PostToolUse hooks should always exit 0
exit 0
`;
}

function sessionStartTemplate(name: string): string {
  return `#!/usr/bin/env bash
# ${name} — SessionStart hook
# Created by claude-code-hookkit create
#
# SessionStart hooks run when a new Claude Code session begins.
set -euo pipefail

# Read JSON input from stdin
INPUT=$(cat)

# Extract fields using grep (pure bash, no external JSON parser required, bash 3.2+ compatible)
SESSION_ID=$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4)
CWD=$(echo "$INPUT" | grep -o '"cwd":"[^"]*"' | head -1 | cut -d'"' -f4)

# TODO: Add your session initialization logic here
# Example: log session start, set up environment, notify external services
# echo "[$SESSION_ID] Session started in $CWD" >> /tmp/session-log.txt

exit 0
`;
}

function stopTemplate(name: string): string {
  return `#!/usr/bin/env bash
# ${name} — Stop hook
# Created by claude-code-hookkit create
#
# Stop hooks run when a Claude Code session ends.
set -euo pipefail

# Read JSON input from stdin
INPUT=$(cat)

# Extract fields using grep (pure bash, no external JSON parser required, bash 3.2+ compatible)
SESSION_ID=$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4)

# TODO: Add your cleanup/summary logic here
# Example: summarize session, flush logs, send notifications
# echo "[$SESSION_ID] Session ended" >> /tmp/session-log.txt

exit 0
`;
}

function genericTemplate(name: string, event: string): string {
  return `#!/usr/bin/env bash
# ${name} — ${event} hook
# Created by claude-code-hookkit create
set -euo pipefail

# Read JSON input from stdin
INPUT=$(cat)

# Extract session_id using grep (pure bash, no external JSON parser required, bash 3.2+ compatible)
SESSION_ID=$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4)

# TODO: Add your hook logic here

exit 0
`;
}
