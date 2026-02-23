# Nefera AI — Hybrid Academic + Production-grade Agentic Platform

Nefera AI is an agentic resume screening platform that converts unstructured candidate resumes and job descriptions into structured signals, scores candidates against a rubric, and produces a decision + rationale that can be used in hiring workflows.

## Problem Statement

Recruiting teams spend significant time on early-stage screening:
- Resumes are unstructured and inconsistent.
- Job requirements are often underspecified or noisy.
- Manual screening introduces delay and variability.

Nefera AI addresses this by standardizing inputs into structured schemas, applying deterministic scoring, and returning an auditable decision output.

## Agentic Architecture (High-Level)

1. **Ingest**: Upload Resume PDF + Job Description PDF
2. **Extract**: Convert PDF text to structured schemas (Resume + Job)
3. **Score**: Compute rubric-aligned dimension scores (0–100) with breakdown
4. **Decide**: Apply thresholds + borderline band logic to produce a decision outcome
5. **Act**: Trigger an action (mock email) for auto-advance / reject

## Tech Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS
- **Backend**: FastAPI, Uvicorn
- **LLM Provider**: Groq (OpenAI-compatible chat completions)
- **PDF Parsing**: PyMuPDF (`fitz`)

## Repository Structure

```
nefera-ai/
  frontend/
  backend/
  docs/
  README.md
  .gitignore
```

## Setup (Local)

### 1) Backend

From `backend/`:

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level info
```

### 2) Frontend

From `frontend/`:

```bash
npm install
npm run dev -- -p 3000
```

Open:
- Frontend: http://localhost:3000
- Backend: http://127.0.0.1:8000

## Environment Variables

Backend (`backend/.env`):

- `GROQ_API_KEY` — required

Frontend (`frontend/.env.local`):

- `NEXT_PUBLIC_API_BASE_URL` — example: `http://127.0.0.1:8000`

## API

### Run evaluation

`POST /api/v1/evaluations/run`

Multipart form-data:
- `resume_file` (PDF)
- `job_file` (PDF)

Response includes:
- `total_score`, `score_breakdown`
- `confidence_score`, `decision_confidence_0_to_1`
- `summary` (strengths, gaps, recommendation)
- `decision`, `decision_reason`, `thresholds_used`

## Evaluation Rubric Alignment

The scoring engine computes weighted dimension scores with an auditable breakdown:
- required skills coverage
- experience alignment
- domain match
- projects presence
- education alignment

The decision layer applies threshold gates and a borderline band to support manual review when appropriate.

## Roadmap

- Multi-tenant accounts and auth
- Persistent evaluation history + audit UI
- Calibrated confidence with feedback loops
- Custom rubric authoring per role
- Integrations (ATS webhook, email provider, Slack)

