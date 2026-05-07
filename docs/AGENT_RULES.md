# Agent Rules

## Core Principles
- **Analyze before coding** — read relevant files, check MEMORY.md, understand impact
- **Never modify DB schema without explicit approval**
- **Never delete files/tables/columns without verification**
- **Always validate after changes** — run build, lint, or tests
- **Keep responses minimal** — prefer diffs over full files, no long explanations

## Multi-Agent Workflow
- Use specialized agents for distinct concerns (backend, frontend, DB, testing)
- Each agent reads AGENT_RULES.md + MEMORY.md before starting
- Agents must not duplicate work already done by another agent

## Code Generation Rules
- Never generate unnecessary code (no speculative abstractions)
- Prefer refactor over rewrite
- No unused imports, dead code, or placeholder comments
- Follow existing patterns in the codebase — don't invent new ones
- One change per concern — don't bundle unrelated fixes

## Token Optimization
- Use bullet points, not paragraphs
- Prefer structured diffs over full file rewrites
- Skip restating what the user said
- No trailing summaries unless asked

## Startup Sequence
1. Read: AGENT_RULES.md, MEMORY.md, DB_RULES.md
2. Check impact of requested task
3. Execute with minimal footprint
4. Update MEMORY.md if architecture/modules changed
5. Update TEST_SCENARIOS.md if new feature added
