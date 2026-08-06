---
name: Bulk Resume Import
description: Architecture and constraints for the bulk resume import feature (POST /candidates/bulk with SSE streaming).
---

## Rule
`POST /recruit/jobs/:jobId/candidates/bulk` streams SSE progress events while processing files. Uses `resumeUpload.array("resumes", 50)` — the existing multer instance, just called with `.array` instead of `.single`.

**Why:** multer must finish reading all file buffers before the handler starts; only then can we set SSE headers and stream. This means the upload itself is synchronous (all 50 files land in memory first), then we stream scoring progress.

## How to apply
- Text extraction is in the standalone `extractResumeText(file)` helper (above the bulk route in recruit.ts) — reuse it for any future multi-file processing.
- Max file size is 5 MB per file (inherited from `resumeUpload` config). Max 50 files per batch.
- SSE events: `start` → `file{status:processing}` → `file{status:done|failed}` → `complete`.
- Frontend parses SSE from a `fetch` POST response body via `ReadableStream` + `TextDecoder` (same pattern as AI Copilot).
- `source` is set to `"bulk_import"` on every candidate created this way.
