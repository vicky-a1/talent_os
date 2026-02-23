"use client";

import React, { useMemo, useState } from "react";

import { Badge, Button, Card, CardBody, CardHeader, Divider, cx } from "../_components/ui";

function Toggle({
  enabled,
  setEnabled,
  label,
  description,
}: {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <div className="text-sm font-semibold text-slate-900">{label}</div>
        <div className="mt-1 text-sm text-slate-600">{description}</div>
      </div>
      <button
        type="button"
        onClick={() => setEnabled(!enabled)}
        className={cx(
          "relative h-8 w-14 rounded-full transition",
          "focus:outline-none focus:ring-2 focus:ring-slate-900/20 motion-reduce:transition-none",
          enabled ? "bg-slate-900" : "bg-slate-200",
        )}
        aria-pressed={enabled}
      >
        <span
          className={cx(
            "absolute top-1 grid h-6 w-6 place-items-center rounded-full bg-white shadow-sm transition",
            "motion-reduce:transition-none",
            enabled ? "left-7" : "left-1",
          )}
        />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [emailIntegration, setEmailIntegration] = useState(true);
  const [calendarIntegration, setCalendarIntegration] = useState(false);
  const [model, setModel] = useState("llama-3.1-8b-instant");
  const [autoAdvance, setAutoAdvance] = useState(80);
  const [manualReview, setManualReview] = useState(60);
  const [saved, setSaved] = useState(false);

  const canSave = useMemo(() => autoAdvance >= manualReview && autoAdvance <= 100 && manualReview >= 0, [autoAdvance, manualReview]);

  return (
    <div className="grid gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
            Settings
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Workspace configuration</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            UI-only controls for integrations, model selection, and scoring thresholds. Does not modify backend behavior.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saved ? <Badge tone="emerald">Saved</Badge> : <Badge tone="slate">Draft</Badge>}
          <Button
            disabled={!canSave}
            onClick={() => {
              setSaved(true);
              window.setTimeout(() => setSaved(false), 1600);
            }}
          >
            Save settings
          </Button>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader title="Integrations" subtitle="Connect your workflow tools" />
          <CardBody>
            <div className="grid gap-6">
              <Toggle
                enabled={emailIntegration}
                setEnabled={setEmailIntegration}
                label="Email integration"
                description="Enable action-based notifications for interview invitations and rejections."
              />
              <Divider className="my-2" />
              <Toggle
                enabled={calendarIntegration}
                setEnabled={setCalendarIntegration}
                label="Calendar integration"
                description="Auto-create interview holds when candidates are auto-advanced (UI only)."
              />
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader title="Groq model" subtitle="UI-only selection" right={<Badge tone="sky">No API change</Badge>} />
          <CardBody>
            <label className="text-sm font-semibold text-slate-900">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-0 transition focus:border-slate-300 focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="llama-3.1-70b-versatile">llama-3.1-70b-versatile</option>
              <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
              <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
            </select>

            <div className="mt-4 text-sm text-slate-600">
              Selected: <span className="font-semibold text-slate-900">{model}</span>
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-12">
          <CardHeader title="Decision thresholds" subtitle="Tune automation boundaries (UI only)" />
          <CardBody>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Auto-advance threshold</div>
                  <div className="text-sm font-semibold text-slate-900">{autoAdvance}</div>
                </div>
                <div className="mt-3 text-sm text-slate-600">Candidates scoring above this are auto-advanced.</div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={autoAdvance}
                  onChange={(e) => setAutoAdvance(Number(e.target.value))}
                  className="mt-4 w-full accent-slate-900"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900">Manual review threshold</div>
                  <div className="text-sm font-semibold text-slate-900">{manualReview}</div>
                </div>
                <div className="mt-3 text-sm text-slate-600">Candidates scoring above this go to manual review.</div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={manualReview}
                  onChange={(e) => setManualReview(Number(e.target.value))}
                  className="mt-4 w-full accent-slate-900"
                />
              </div>
            </div>

            <div className="mt-6 rounded-2xl border px-4 py-3 text-sm">
              {canSave ? (
                <div className="border-emerald-200 bg-emerald-50 text-emerald-800 rounded-2xl px-4 py-3">
                  Thresholds are valid. Auto-advance ≥ manual review.
                </div>
              ) : (
                <div className="border-rose-200 bg-rose-50 text-rose-800 rounded-2xl px-4 py-3">
                  Invalid thresholds. Auto-advance must be greater than or equal to manual review.
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
