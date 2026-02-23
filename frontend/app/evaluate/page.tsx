"use client";

import React, { useCallback, useMemo, useState } from "react";

import { FileDropzone } from "../_components/file-dropzone";
import { useAnimatedNumber, useFakeProgress, usePrefersReducedMotion } from "../_components/hooks";
import { ScoreRing } from "../_components/score-ring";
import { Badge, Button, Card, CardBody, CardHeader, Divider, cx } from "../_components/ui";

type DimensionRow = {
  score_0_to_1: number;
  weight_0_to_1: number;
  contribution_0_to_100: number;
};

type EvaluationResult = {
  evaluation_id: string | null;
  total_score: number;
  confidence_score?: number;
  decision_confidence_0_to_1?: number;
  summary?: { strengths: string[]; gaps: string[]; recommendation: string } | null;
  score_breakdown: {
    total_score_0_to_100?: number;
    weights?: Record<string, number>;
    dimensions?: Record<string, DimensionRow>;
  };
  decision: "AUTO_ADVANCE" | "MANUAL_REVIEW" | "REJECT" | string;
  decision_reason: string;
  thresholds_used?: { auto_advance: number; manual_review: number };
  action_triggered: boolean;
  action_type: string | null;
} & Record<string, unknown>;

function formatPct01(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

function scoreTone(score: number) {
  if (!Number.isFinite(score)) return "slate";
  if (score >= 80) return "emerald";
  if (score >= 60) return "amber";
  return "rose";
}

function decisionTone(decision: string) {
  if (decision === "AUTO_ADVANCE") return "emerald";
  if (decision === "MANUAL_REVIEW") return "amber";
  if (decision === "REJECT") return "rose";
  return "slate";
}

function decisionIcon(decision: string) {
  if (decision === "AUTO_ADVANCE") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (decision === "MANUAL_REVIEW") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 9v4" strokeLinecap="round" />
        <path d="M12 17h.01" strokeLinecap="round" />
        <path
          d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18" strokeLinecap="round" />
      <path d="M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function getCandidateMeta(result: EvaluationResult | null) {
  if (!result) return { name: null as string | null, years: null as number | null };
  const r = result as Record<string, unknown>;
  const resume = (r["resume"] ?? r["resume_structured"] ?? r["candidate"]) as Record<string, unknown> | undefined;
  const name = resume?.["full_name"] ?? resume?.["name"];
  const years = resume?.["years_experience"] ?? resume?.["years_of_experience"];
  return {
    name: typeof name === "string" && name.trim() ? name.trim() : null,
    years: typeof years === "number" && Number.isFinite(years) ? years : null,
  };
}

function ProcessingSkeleton() {
  return (
    <Card>
      <CardHeader title="Processing" subtitle="AI extracting structured data, scoring, and decisioning" />
      <CardBody>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="h-4 w-56 rounded-full nefera-skeleton" />
            <div className="h-3 w-96 max-w-full rounded-full nefera-skeleton" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="h-3 w-28 rounded-full nefera-skeleton" />
              <div className="mt-3 h-8 w-24 rounded-xl nefera-skeleton" />
              <div className="mt-4 h-3 w-40 rounded-full nefera-skeleton" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <div className="h-3 w-28 rounded-full nefera-skeleton" />
              <div className="mt-3 h-8 w-24 rounded-xl nefera-skeleton" />
              <div className="mt-4 h-3 w-40 rounded-full nefera-skeleton" />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
            <div className="h-3 w-36 rounded-full nefera-skeleton" />
            <div className="mt-4 grid gap-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <div className="h-3 w-40 rounded-full nefera-skeleton" />
                    <div className="h-3 w-12 rounded-full nefera-skeleton" />
                  </div>
                  <div className="h-2 w-full rounded-full nefera-skeleton" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default function EvaluatePage() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobFile, setJobFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

  const reducedMotion = usePrefersReducedMotion();
  const fakeProgress = useFakeProgress(loading && !reducedMotion);
  const activeStepLabel = loading
    ? fakeProgress < 0.35
      ? "Extracting"
      : fakeProgress < 0.7
        ? "Scoring"
        : "Decisioning"
    : null;

  const canSubmit = useMemo(() => {
    return Boolean(apiBaseUrl) && Boolean(resumeFile) && Boolean(jobFile) && !loading;
  }, [apiBaseUrl, resumeFile, jobFile, loading]);

  const breakdownRows = useMemo(() => {
    const dims = result?.score_breakdown?.dimensions ?? {};
    const entries = Object.entries(dims);
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    return entries;
  }, [result]);

  const score = result?.total_score ?? 0;
  const scoreClass = scoreTone(score);
  const decision = result?.decision ?? "";
  const decisionClass = decisionTone(decision);

  const animatedScore = useAnimatedNumber(
    score,
    900,
    Boolean(result) && !reducedMotion,
  );

  const candidate = useMemo(() => getCandidateMeta(result), [result]);

  const strengths = useMemo(() => {
    return breakdownRows
      .filter(([, row]) => Number.isFinite(row.score_0_to_1) && row.score_0_to_1 >= 0.8)
      .map(([k]) => k);
  }, [breakdownRows]);

  const gaps = useMemo(() => {
    return breakdownRows
      .filter(([, row]) => Number.isFinite(row.score_0_to_1) && row.score_0_to_1 < 0.6)
      .map(([k]) => k);
  }, [breakdownRows]);

  const summary = useMemo(() => {
    const s = result?.summary;
    if (!s || typeof s !== "object") return null;
    const strengths = Array.isArray((s as any).strengths) ? ((s as any).strengths as unknown[]) : [];
    const gaps = Array.isArray((s as any).gaps) ? ((s as any).gaps as unknown[]) : [];
    const recommendation = typeof (s as any).recommendation === "string" ? ((s as any).recommendation as string) : "";
    const strengthsClean = strengths.filter((x) => typeof x === "string" && x.trim()).map((x) => String(x).trim());
    const gapsClean = gaps.filter((x) => typeof x === "string" && x.trim()).map((x) => String(x).trim());
    if (!strengthsClean.length && !gapsClean.length && !recommendation.trim()) return null;
    return { strengths: strengthsClean, gaps: gapsClean, recommendation: recommendation.trim() };
  }, [result]);

  const confidencePct = useMemo(() => {
    const v = result?.confidence_score;
    if (!Number.isFinite(v)) return null;
    return Math.round(Math.min(1, Math.max(0, v ?? 0)) * 100);
  }, [result?.confidence_score]);

  const decisionConfidencePct = useMemo(() => {
    const v = result?.decision_confidence_0_to_1;
    if (!Number.isFinite(v)) return null;
    return Math.round(Math.min(1, Math.max(0, v ?? 0)) * 100);
  }, [result?.decision_confidence_0_to_1]);

  const confidenceTone = useMemo(() => {
    if (confidencePct === null) return "slate" as const;
    if (confidencePct >= 75) return "emerald" as const;
    if (confidencePct >= 55) return "amber" as const;
    return "rose" as const;
  }, [confidencePct]);

  const runEvaluation = useCallback(async () => {
    setError(null);
    setResult(null);

    if (!apiBaseUrl) {
      setError("Missing NEXT_PUBLIC_API_BASE_URL.");
      return;
    }
    if (!resumeFile || !jobFile) {
      setError("Please upload both Resume PDF and Job Description PDF.");
      return;
    }
    if (resumeFile.size > 5 * 1024 * 1024 || jobFile.size > 5 * 1024 * 1024) {
      setError("Each file must be 5MB or smaller.");
      return;
    }
    if (resumeFile.type && resumeFile.type !== "application/pdf") {
      setError("Resume file must be a PDF.");
      return;
    }
    if (jobFile.type && jobFile.type !== "application/pdf") {
      setError("Job Description file must be a PDF.");
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append("resume_file", resumeFile);
      form.append("job_file", jobFile);

      const baseUrl = apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
      const resp = await fetch(`${baseUrl}/api/v1/evaluations/run`, {
        method: "POST",
        body: form,
      });

      const contentType = resp.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json") ? await resp.json() : await resp.text();

      if (!resp.ok) {
        const detail = (() => {
          if (typeof payload === "string") return payload;
          const p = payload as Record<string, unknown> | null;
          const d = p?.["detail"];
          return d ? String(d) : `Request failed with status ${resp.status}`;
        })();
        setError(detail);
        return;
      }

      setResult(payload as EvaluationResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, jobFile, resumeFile]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await runEvaluation();
  }

  return (
    <div className="grid gap-8">
      <header className="grid gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
              Evaluate
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Premium candidate evaluation
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
              Drag & drop a Resume PDF and a Job Description PDF. Nefera will extract structured data, score deterministically,
              and produce a decision with a clear breakdown.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="slate">Max 5MB per file</Badge>
            {apiBaseUrl ? <Badge tone="emerald">API Connected</Badge> : <Badge tone="rose">API Not Configured</Badge>}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-semibold text-slate-900">{activeStepLabel ? `${activeStepLabel}…` : "Processing…"}</div>
              <div className="text-xs font-medium text-slate-600">{Math.round(fakeProgress * 100)}%</div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-slate-900 transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{ width: `${Math.round(fakeProgress * 100)}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              {[
                { label: "Extracting", on: fakeProgress < 0.35 },
                { label: "Scoring", on: fakeProgress >= 0.35 && fakeProgress < 0.7 },
                { label: "Decisioning", on: fakeProgress >= 0.7 },
              ].map((s) => (
                <span
                  key={s.label}
                  className={cx(
                    "rounded-full border px-3 py-1 transition motion-reduce:transition-none",
                    s.on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600",
                  )}
                >
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-12 lg:gap-8">
        <section className="min-w-0 lg:col-span-5">
          <form onSubmit={onSubmit} className="grid gap-4">
            <FileDropzone
              title="Resume PDF"
              description="Candidate document for structured extraction."
              file={resumeFile}
              setFile={setResumeFile}
              disabled={loading}
              maxBytes={5 * 1024 * 1024}
            />
            <FileDropzone
              title="Job Description PDF"
              description="Role description for rubric-aligned evaluation."
              file={jobFile}
              setFile={setJobFile}
              disabled={loading}
              maxBytes={5 * 1024 * 1024}
            />

            {!apiBaseUrl ? (
              <Card className="border-rose-200 bg-rose-50/70">
                <CardBody>
                  <div className="text-sm font-semibold text-rose-900">API base URL missing</div>
                  <div className="mt-1 text-sm text-rose-800 whitespace-pre-wrap">
                    NEXT_PUBLIC_API_BASE_URL is not set. Add it to .env.local to enable evaluations.
                  </div>
                </CardBody>
              </Card>
            ) : null}

            {error ? (
              <Card className="border-rose-200 bg-rose-50/70">
                <CardHeader title="We couldn’t complete the evaluation" subtitle="Review the details and retry." right={<Badge tone="rose">Error</Badge>} />
                <CardBody>
                  <div className="rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-900 whitespace-pre-wrap">
                    {error}
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      disabled={!canSubmit}
                      type="button"
                      onClick={() => runEvaluation()}
                      className="w-full sm:w-auto"
                    >
                      Retry
                    </Button>
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => {
                        setError(null);
                        setResult(null);
                      }}
                      className="w-full sm:w-auto"
                    >
                      Reset
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ) : null}

            <Card>
              <CardHeader title="Run evaluation" subtitle="Multipart upload to backend API" />
              <CardBody>
                <div className="grid gap-3">
                  <Button type="submit" disabled={!canSubmit} className="w-full">
                    {loading ? (
                      <span
                        aria-label="Loading"
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
                      />
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v8" strokeLinecap="round" />
                        <path d="M7 7l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M4 14v4a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-4" strokeLinecap="round" />
                      </svg>
                    )}
                    Submit
                  </Button>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>Endpoint: /api/v1/evaluations/run</span>
                    <span className="font-medium text-slate-700">{loading ? "Processing" : "Ready"}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </form>
        </section>

        <section className="min-w-0 lg:col-span-7">
          {loading ? (
            <ProcessingSkeleton />
          ) : (
            <Card className={cx(result ? "nefera-reveal shadow-lg hover:shadow-lg" : "")}>
              <CardHeader
                title="Results"
                subtitle="Score, decision, and breakdown for this evaluation."
                right={
                  <div className="hidden items-center gap-2 sm:flex">
                    {result ? <Badge tone="emerald">Structured Resume Created</Badge> : <Badge tone="slate">Awaiting run</Badge>}
                    {confidencePct !== null ? <Badge tone={confidenceTone}>Confidence {confidencePct}%</Badge> : null}
                    {decisionConfidencePct !== null ? <Badge tone="slate">Decision {decisionConfidencePct}%</Badge> : null}
                    <Badge tone="slate">{result?.evaluation_id ? `ID ${result.evaluation_id}` : "Not persisted"}</Badge>
                  </div>
                }
              />
              <CardBody>
                {!result ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
                    <div className="mx-auto max-w-sm">
                      <div className="text-sm font-semibold text-slate-900">No results yet</div>
                      <div className="mt-2 text-sm text-slate-600">
                        Upload both PDFs and run an evaluation to see the score, decision, and breakdown.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    <div className="grid min-w-0 gap-6 lg:grid-cols-12">
                      <div className="min-w-0 lg:col-span-5">
                        <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
                          <ScoreRing
                            value0to100={score}
                            animatedValue0to100={animatedScore}
                            tone={scoreClass}
                            label="Score"
                            size={140}
                            stroke={12}
                          />
                          <div className="grid gap-1">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Candidate insights
                            </div>
                            <div className="text-sm text-slate-700">
                              <span className="font-semibold text-slate-900">Name:</span>{" "}
                              {candidate.name ?? "—"}
                            </div>
                            <div className="text-sm text-slate-700">
                              <span className="font-semibold text-slate-900">Experience:</span>{" "}
                              {candidate.years !== null ? `${candidate.years} years` : "—"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 lg:col-span-7">
                        <div className="grid gap-4">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="grid gap-1">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Decision</div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                  <span className={cx("grid h-9 w-9 place-items-center rounded-xl", decisionClass === "emerald" ? "bg-emerald-50 text-emerald-700" : decisionClass === "amber" ? "bg-amber-50 text-amber-700" : decisionClass === "rose" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-700")}>
                                    {decisionIcon(decision)}
                                  </span>
                                  {decision}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Badge tone={decisionClass}>{decision.replace("_", " ")}</Badge>
                                {result.action_triggered ? (
                                  <Badge tone="emerald">Action Triggered</Badge>
                                ) : (
                                  <Badge tone="slate">No Action</Badge>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 break-words text-sm leading-6 text-slate-600">{result.decision_reason}</div>
                            {result.action_type ? (
                              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                <span className="font-semibold text-slate-900">Action:</span> {result.action_type}
                              </div>
                            ) : null}
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested next action</div>
                            <div className="mt-2 text-sm font-semibold text-slate-900">
                              {decision === "AUTO_ADVANCE"
                                ? "Schedule an interview and send the invitation."
                                : decision === "MANUAL_REVIEW"
                                  ? "Request a recruiter review and validate key requirements."
                                  : "Archive the candidate and optionally send a rejection notice."}
                            </div>
                            <div className="mt-2 text-sm text-slate-600">
                              This recommendation is derived from the decision outcome and does not modify scoring logic.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Divider className="my-6" />

                    <div className="grid min-w-0 gap-4 lg:grid-cols-12">
                      <div className="min-w-0 lg:col-span-7">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">Breakdown</div>
                              <div className="mt-1 text-sm text-slate-600">Per-dimension score signal with smooth bars.</div>
                            </div>
                            <Badge tone={scoreClass}>Overall {Math.round(score)}/100</Badge>
                          </div>

                          <div className="mt-4 grid gap-2">
                            {breakdownRows.length === 0 ? (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                No breakdown data returned.
                              </div>
                            ) : (
                              breakdownRows.map(([name, row], idx) => {
                                const pct = Math.min(1, Math.max(0, row.score_0_to_1 || 0)) * 100;
                                return (
                                  <div
                                    key={name}
                                    className={cx(
                                      "group rounded-2xl border border-slate-200 bg-white px-4 py-3 transition",
                                      "hover:shadow-sm",
                                      idx % 2 === 0 ? "bg-slate-50/40" : "bg-white",
                                    )}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="text-sm font-semibold text-slate-900">{name}</div>
                                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                        <span className="text-slate-500">Score</span>
                                        {formatPct01(row.score_0_to_1)}
                                        <span className="text-slate-400">•</span>
                                        <span className="text-slate-500">Weight</span>
                                        {formatPct01(row.weight_0_to_1)}
                                      </div>
                                    </div>
                                    <div className="mt-3 h-2 rounded-full bg-slate-100">
                                      <div
                                        className={cx(
                                          "h-2 rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none",
                                          pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500",
                                        )}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                    <div className="mt-2 text-xs text-slate-500">
                                      Contribution: <span className="font-semibold text-slate-700">{row.contribution_0_to_100.toFixed(2)}</span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          <details className="mt-4">
                            <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
                              Show table fallback
                            </summary>
                            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                  <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide sm:px-4">Dimension</th>
                                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide sm:px-4">Score</th>
                                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide sm:px-4">Weight</th>
                                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide sm:px-4">Contribution</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {breakdownRows.map(([name, row]) => (
                                      <tr key={name} className="transition-colors odd:bg-slate-50/40 hover:bg-slate-100/60">
                                        <td className="px-3 py-3 font-medium text-slate-900 sm:px-4">{name}</td>
                                        <td className="px-3 py-3 text-slate-700 sm:px-4">{formatPct01(row.score_0_to_1)}</td>
                                        <td className="px-3 py-3 text-slate-700 sm:px-4">{formatPct01(row.weight_0_to_1)}</td>
                                        <td className="px-3 py-3 text-slate-700 sm:px-4">{row.contribution_0_to_100.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </details>
                        </div>
                      </div>

                      <div className="min-w-0 lg:col-span-5">
                        <div className="grid gap-4">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                            <div className="text-sm font-semibold text-slate-900">AI Summary</div>
                            <div className="mt-2 text-sm leading-6 text-slate-600">
                              {summary?.recommendation
                                ? summary.recommendation
                                : "A concise, structured summary will appear here when available."}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                            <div className="text-sm font-semibold text-slate-900">Strengths</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(summary?.strengths?.length ? summary.strengths : strengths).length ? (
                                (summary?.strengths?.length ? summary.strengths : strengths).map((t) => (
                                  <Badge key={t} tone="emerald">
                                    {t}
                                  </Badge>
                                ))
                              ) : (
                                <div className="text-sm text-slate-600">No strong dimensions detected.</div>
                              )}
                            </div>
                            <Divider className="my-4" />
                            <div className="text-sm font-semibold text-slate-900">Gaps</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(summary?.gaps?.length ? summary.gaps : gaps).length ? (
                                (summary?.gaps?.length ? summary.gaps : gaps).map((t) => (
                                  <Badge key={t} tone="amber">
                                    {t}
                                  </Badge>
                                ))
                              ) : (
                                <div className="text-sm text-slate-600">No gaps flagged.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
