import { AppTopBar } from "@/components/layout/AppTopBar";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";

const placeholderStats = [
  { label: "Patients today", value: "—" },
  { label: "Therapists on duty", value: "—" },
  { label: "Revenue today", value: "—" },
  { label: "Open slots", value: "—" },
];

export default function DashboardPage() {
  return (
    <>
      <AppTopBar
        title="Dashboard"
        description="Live clinic overview for today"
        actions={<Button>Book appointment</Button>}
      />

      <div className="space-y-6 p-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {placeholderStats.map((stat) => (
            <Card key={stat.label}>
              <p className="text-sm text-text-secondary">{stat.label}</p>
              <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-text-primary">
                <span className="font-mono text-[1.65rem]">{stat.value}</span>
              </p>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <CardTitle>Therapist capacity</CardTitle>
              <StatusPill tone="neutral">Coming soon</StatusPill>
            </div>
            <p className="text-sm leading-6 text-text-secondary">
              Booked vs free slots for therapists on duty will appear here once
              scheduling APIs are connected.
            </p>
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between gap-3">
              <CardTitle>Recent patients</CardTitle>
              <StatusPill tone="primary">Design base</StatusPill>
            </div>
            <p className="text-sm leading-6 text-text-secondary">
              Latest patients with condition, therapist, package, and status
              will list here.
            </p>
          </Card>
        </section>
      </div>
    </>
  );
}
