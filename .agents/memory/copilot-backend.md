---
name: AI Copilot backend architecture
description: How the Ask Rolebolt AI Hiring Copilot is built — model, prompt system, streaming, routes, frontend
---

## Model: RecruitCopilotConversation
- Generic context: { level: "global"|"job"|"candidate"|"form", jobId?, candidateId?, formId? }
- Conversation metadata: lastActiveAt, totalMessages, selectedJobId, selectedJobTitle
- Per-message: recommendation, confidence (0-100), reasoning, sources[], quickActions[]
- Source shape: { type, label, candidateId, resumeId, assessmentId, page, sectionId, detail }

## Prompt builder: buildCopilotPrompt (backend/src/ai/buildCopilotPrompt.ts)
- Accepts mode: "json" | "stream"
- JSON mode: AI returns full structured JSON in one response
- Stream mode: AI writes reply text, then outputs ---ROLEBOLT_META---, then JSON metadata

## Streaming: streamMeshChatCompletions (backend/src/ai/meshClient.ts)
- Async generator yielding string tokens from OpenAI-compatible SSE
- Uses AbortController for timeout; caller handles sentinel split + DB persist

## Routes (backend/src/recruitCopilot.ts, mounted at /recruit/copilot)
- POST /chat — full JSON non-streaming
- POST /chat/stream — SSE streaming with sentinel pattern
- GET/DELETE /conversations + GET /conversations/:id + POST /conversations/:id/clear
- GET /starter-actions

**Why streaming uses sentinel:** Avoids double AI calls. AI streams reply naturally, appends ---ROLEBOLT_META--- + JSON. Frontend splits on sentinel, streams reply tokens live, parses metadata at end.

## Frontend: /recruit/copilot (frontend/src/app/recruit/copilot/page.tsx)
- Three-column dark layout: left sidebar (jobs + history) | chat | right context panel
- Streaming via fetch ReadableStream + buffer split on \n\n (POST not supported by EventSource)
- react-markdown + remark-gfm installed; .copilot-markdown CSS class in globals.css
- "Ask Rolebolt" nav link in RecruitHeader CREATOR_NAV section
- Form context requires the conversation schema enum and persisted formId to be updated together; Form answers use label/value fields
