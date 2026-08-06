---
name: Copilot input focus loss during streaming
description: Textarea disabled while AI streams causes browser to blur it — root cause of "must click textbox again" bug
---

Disabling an `<input>`/`<textarea>` while an async response streams causes the
browser to blur it automatically, losing focus/cursor. This looked like a
UX bug ("I have to click the box again after each AI reply") but the real
cause was `disabled={isStreaming}` on the textarea.

**Why:** Disabled form elements cannot hold focus in any browser — the disable
takes effect immediately and forces a blur, regardless of surrounding React
state.

**How to apply:** Never disable the input during streaming to block sends —
the send handler itself already guards against concurrent sends. Only disable
inputs for genuinely blocking conditions (e.g. no context selected yet), and
restore focus with `requestAnimationFrame(() => ref.current?.focus())` after
an async operation completes if focus may have shifted.
