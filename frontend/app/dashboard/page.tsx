import Link from "next/link";

import { Badge, Card, CardBody, CardHeader, Divider, cx } from "../_components/ui";

type RecentEvaluation = {
  id: string;
  candidate: string;
  role: string;
  decision: "AUTO_ADVANCE" | "MANUAL_REVIEW" | "REJECT";
  score: number;
  when: string;
};

const recent: RecentEvaluation[] = [
  { id: "EV-1042", candidate: "Aarav Patel", role: "Senior Frontend Engineer", decision: "AUTO_ADVANCE", score: 91, when: "2h ago" },
  { id: "EV-1041", candidate: "Meera Iyer", role: "Product Analyst", decision: "MANUAL_REVIEW", score: 68, when: "5h ago" },
  { id: "EV-1040", candidate: "Zoya Khan", role: "ML Engineer", decision: "REJECT", score: 54, when: "Yesterday" },
  { id: "EV-1039", candidate: "Rohan Gupta", role: "Backend Engineer", decision: "AUTO_ADVANCE", score: 86, when: "Yesterday" },
];

function decisionTone(decision: RecentEvaluation["decision"]) {
  if (decision === "AUTO_ADVANCE") return "emerald";
  if (decision === "MANUAL_REVIEW") return "amber";
  return "rose";
}

export default function DashboardPage() {
  const totals = {
    totalEvaluations: 124,
    autoAdvance: 52,
    manualReview: 41,
    rejected: 31,
    avgScore: 74.6,
  };

  const chart = [
    { label: "Mon", v: 6 },
    { label: "Tue", v: 12 },
    { label: "Wed", v: 9 },
    { label: "Thu", v: 15 },
    { label: "Fri", v: 10 },
    { label: "Sat", v: 4 },
    { label: "Sun", v: 7 },
  ];

  const max = Math.max(...chart.map((x) => x.v), 1);

  return (
    <div className="grid gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
            Dashboard
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Talent pipeline at a glance
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Monitor evaluation outcomes, quality signals, and operational throughput. This page uses mock data for UI.
          </p>
        </div>

        <Link
          href="/evaluate"
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          Run an evaluation
        </Link>
      </header>

      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader title="Total evaluations" subtitle="All-time executions" right={<Badge tone="violet">SaaS</Badge>} />
          <CardBody>
            <div className="flex items-end justify-between gap-4">
              <div className="text-5xl font-semibold tracking-tight text-slate-900">{totals.totalEvaluations}</div>
              <div className="text-sm text-slate-600">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">This week</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">+18</div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-7 gap-2">
              {chart.map((x) => (
                <div key={x.label} className="grid gap-2">
                  <div className="flex h-16 items-end rounded-xl bg-slate-50 p-1">
                    <div
                      className={cx(
                        "h-full w-full rounded-lg bg-gradient-to-b from-slate-900 to-slate-700 transition",
                        "motion-reduce:transition-none",
                      )}
                      style={{ height: `${Math.round((x.v / max) * 100)}%` }}
                    />
                  </div>
                  <div className="text-center text-xs font-medium text-slate-500">{x.label}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Auto-advanced" subtitle=">= threshold" />
          <CardBody>
            <div className="text-4xl font-semibold tracking-tight text-slate-900">{totals.autoAdvance}</div>
            <div className="mt-2 text-sm text-slate-600">High-confidence candidates</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Manual review" subtitle="Needs oversight" />
          <CardBody>
            <div className="text-4xl font-semibold tracking-tight text-slate-900">{totals.manualReview}</div>
            <div className="mt-2 text-sm text-slate-600">Borderline or nuanced profiles</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Rejected" subtitle="< threshold" />
          <CardBody>
            <div className="text-4xl font-semibold tracking-tight text-slate-900">{totals.rejected}</div>
            <div className="mt-2 text-sm text-slate-600">Low match signal</div>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader title="Average score" subtitle="Rolling 30 days" />
          <CardBody>
            <div className="flex items-end justify-between gap-4">
              <div className="text-5xl font-semibold tracking-tight text-slate-900">{totals.avgScore.toFixed(1)}</div>
              <Badge tone="sky">Stable</Badge>
            </div>
            <Divider className="my-4" />
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Median</span>
                <span className="font-semibold text-slate-900">72.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span>p90</span>
                <span className="font-semibold text-slate-900">89.0</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Lowest</span>
                <span className="font-semibold text-slate-900">38.0</span>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-8">
          <CardHeader title="Recent evaluations" subtitle="Mock list for submission UI" />
          <CardBody>
            <div className="grid gap-3">
              {recent.map((row) => (
                <div
                  key={row.id}
                  className={cx(
                    "flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition",
                    "hover:shadow-sm sm:flex-row sm:items-center sm:justify-between",
                  )}
                >
                  <div className="grid gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-900">{row.candidate}</div>
                      <div className="text-xs text-slate-500">{row.id}</div>
                    </div>
                    <div className="text-sm text-slate-600">{row.role}</div>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-sm font-semibold text-slate-900">{row.score}/100</div>
                    <Badge tone={decisionTone(row.decision)}>{row.decision.replace("_", " ")}</Badge>
                    <div className="text-xs text-slate-500">{row.when}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
