# Product Evidence — Build with Gemini XPRIZE

This folder is for **hackathon submission evidence** required by the [Build with Gemini XPRIZE](https://xprize.devpost.com/) judging criteria.

## What to include

Add the following before final submission (do **not** commit secrets or billing PDFs with account numbers visible):

| File | Description |
|------|-------------|
| `gcp-billing-summary.pdf` | Google Cloud billing summary showing active GCP usage |
| `gemini-api-usage.png` | Screenshot of Gemini API usage dashboard (Google AI Studio or Cloud Console) |
| `agent-operations-log.md` | Narrative of how AI agents run core business operations (support, content, ops) |
| `revenue-proof.pdf` | Redacted proof of real revenue (invoices, Razorpay dashboard, etc.) |

## Gemini & Google Cloud usage in Rolebolt

Rolebolt is built around **Google Gemini** for hiring intelligence:

- **Job description generation** — `GEMINI_PRIMARY_KEY` via direct Gemini API (`backend/src/ai/geminiClient.ts`)
- **Resume scoring & rubrics** — Gemini models via Mesh API gateway (`GEMINI_MESH_KEY`)
- **Recruiting Copilot** — conversational AI grounded in job and candidate context
- **Form job scoring** — structured application evaluation
- **Daily hiring briefings** — automated recruiter summaries
- **Sitegen** — AI-generated portfolio websites from resume text

Supporting infrastructure runs on **MongoDB Atlas** and deploys to **Render**; Firebase handles Google/Microsoft SSO.

## Live product

- **Website:** https://www.rolebolt.tech
- **Judges testing kit:** https://www.rolebolt.tech/recruit/judges

## Notes for judges

1. Create a free account or use the pre-built testing kit on the judges page.
2. Walk through: create a job → import resumes → review AI scores → use Copilot → publish a public opportunity.
3. Job seekers can browse public roles at `/recruit/opportunities` (private jobs are hidden from the public board).
4. Read **[`JUDGES.md`](../JUDGES.md)** for the full technical brief — Google Cloud stack, architecture diagrams, Gemini usage map, and roadmap.
