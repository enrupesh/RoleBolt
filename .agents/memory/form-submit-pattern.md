---
name: Form submission non-blocking pattern
description: How to handle AI scoring in public form submission without blocking the candidate response
---

## Rule
Never `await` AI scoring inside a candidate-facing POST route. Persist the record first (with `scoringFailed: true`), return 201 to the candidate, then patch AI results via `setImmediate`.

## Why
AI scoring via external LLM can take 3-15 seconds and occasionally times out. Blocking candidate submission on it causes:
- Slow perceived form submission (bad UX for candidates)
- Submission failures when AI is slow/down (candidates lose their response)

## How to apply
```typescript
// 1. Save with scoringFailed: true
const response = await Model.create({ ..., scoringFailed: true });

// 2. Increment counters (fire-and-forget)
Counter.findByIdAndUpdate(id, { $inc: { count: 1 } }).catch(console.error);

// 3. Return immediately
res.status(201).json({ ok: true, responseId: response._id });

// 4. Score in background
setImmediate(async () => {
  const scored = await scoreThings();
  await Model.findByIdAndUpdate(response._id, { $set: { ...scored } });
});
```
Also: add a 4-arg error middleware after file upload routes to catch multer errors and return structured JSON (not framework HTML).
