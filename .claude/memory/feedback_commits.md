---
name: no-claude-attribution-in-commits
description: Do not add Claude as co-author in git commit messages
type: feedback
---

Do not add "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>" (or any Claude attribution) to git commit messages.

**Why:** User preference — commits should not show Claude as contributor.

**How to apply:** When creating any git commit, omit the Co-Authored-By trailer entirely.
