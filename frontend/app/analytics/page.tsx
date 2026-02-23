import { Badge, Card, CardBody, CardHeader, Divider, cx } from "../_components/ui";

export default function AnalyticsPage() {
  const distribution = [
    { label: "0–39", v: 8, tone: "bg-rose-500" },
    { label: "40–59", v: 18, tone: "bg-amber-500" },
    { label: "60–79", v: 34, tone: "bg-amber-500" },
    { label: "80–100", v: 40, tone: "bg-emerald-500" },
  ];

  const max = Math.max(...distribution.map((d) => d.v), 1);

  return (
    <div className="grid gap-8">
      <header>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
          Analytics
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Quality and funnel insights</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
          Professional, screenshot-ready analytics layout with static placeholders. No backend changes required.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader title="Score distribution" subtitle="Static placeholder chart" right={<Badge tone="sky">Mock</Badge>} />
          <CardBody>
            <div className="grid gap-4">
              <div className="grid gap-3">
                {distribution.map((d) => (
                  <div key={d.label} className="grid gap-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-medium text-slate-700">{d.label}</div>
                      <div className="text-slate-600">{d.v}%</div>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100">
                      <div
                        className={cx("h-3 rounded-full transition motion-reduce:transition-none", d.tone)}
                        style={{ width: `${Math.round((d.v / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Divider className="my-6" />

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">p50 score</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">72</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">p90 score</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">89</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">avg score</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">74.6</div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader title="Hiring funnel" subtitle="Visualization placeholder" />
          <CardBody>
            <div className="grid gap-4">
              {[
                { label: "Evaluated", v: 124, tone: "bg-slate-900" },
                { label: "Manual review", v: 41, tone: "bg-amber-500" },
                { label: "Auto-advanced", v: 52, tone: "bg-emerald-500" },
                { label: "Rejected", v: 31, tone: "bg-rose-500" },
              ].map((row) => (
                <div key={row.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900">{row.label}</div>
                    <div className="text-sm font-semibold text-slate-900">{row.v}</div>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-100">
                    <div className={cx("h-2 rounded-full", row.tone)} style={{ width: `${Math.min(100, row.v)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader title="Time-to-decision" subtitle="Median" />
          <CardBody>
            <div className="text-4xl font-semibold tracking-tight text-slate-900">2.4m</div>
            <div className="mt-2 text-sm text-slate-600">From upload to decision</div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Conversion rate" subtitle="Auto-advance / total" />
          <CardBody>
            <div className="text-4xl font-semibold tracking-tight text-slate-900">41.9%</div>
            <div className="mt-2 text-sm text-slate-600">High-confidence matches</div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Escalation rate" subtitle="Manual review share" />
          <CardBody>
            <div className="text-4xl font-semibold tracking-tight text-slate-900">33.1%</div>
            <div className="mt-2 text-sm text-slate-600">Human-in-the-loop</div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Rejection rate" subtitle="Rejected share" />
          <CardBody>
            <div className="text-4xl font-semibold tracking-tight text-slate-900">25.0%</div>
            <div className="mt-2 text-sm text-slate-600">Low match signal</div>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
