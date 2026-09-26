"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { PatientFormModal } from "@/components/patients/PatientFormModal";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  ApiError,
  apiGet,
  apiPatch,
  type Package,
  type Paginated,
  type PatientDetail,
  type PatientPayload,
  type PatientStatus,
  type Therapist,
} from "@/lib/api";

type Tab = "overview" | "sessions" | "billing";

function statusTone(status: PatientStatus): "success" | "neutral" {
  return status === "active" ? "success" : "neutral";
}

function statusLabel(status: PatientStatus): string {
  if (status === "on_hold") return "On hold";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function invoiceTone(status: string): "success" | "neutral" | "danger" {
  if (status === "paid") return "success";
  return "neutral";
}

function sessionTone(status: string): "success" | "neutral" | "danger" {
  if (status === "completed" || status === "booked") return "success";
  if (status === "cancelled" || status === "no_show") return "danger";
  return "neutral";
}

export function PatientDetailClient({ patientId }: { patientId: number }) {
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, tPage, pRows] = await Promise.all([
        apiGet<PatientDetail>(`/api/v1/patients/${patientId}`, true),
        apiGet<Paginated<Therapist>>("/api/v1/therapists?page_size=100", true),
        apiGet<Package[]>("/api/v1/packages", true),
      ]);
      setPatient(detail);
      setTherapists(tPage.items);
      setPackages(pRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load patient");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpdate(payload: PatientPayload) {
    await apiPatch(`/api/v1/patients/${patientId}`, payload, true);
    await load();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "sessions", label: "Session history" },
    { id: "billing", label: "Billing history" },
  ];

  return (
    <>
      <AppTopBar
        title={patient?.full_name ?? "Patient"}
        description={
          patient
            ? `${patient.condition} · ${patient.therapist_name}`
            : "Patient profile"
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href="/patients">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 shrink-0" />
                Back
              </Button>
            </Link>
            {patient ? (
              <Button onClick={() => setFormOpen(true)}>
                <Pencil className="h-4 w-4 shrink-0" />
                Edit
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="space-y-4 p-6">
        {error ? (
          <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        {loading || !patient ? (
          <Card>
            <p className="text-sm text-text-secondary">
              {loading ? "Loading profile…" : "Patient not found."}
            </p>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 border-b border-border pb-3">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={
                    tab === t.id
                      ? "rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary-text-on-soft"
                      : "rounded-full px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-background"
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "overview" ? (
              <Card>
                <CardTitle className="mb-4">Overview</CardTitle>
                <dl className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ["Full name", patient.full_name],
                      ["Phone", patient.phone],
                      ["Age", String(patient.age)],
                      ["Gender", patient.gender],
                      ["Address", patient.address || "—"],
                      ["Condition", patient.condition],
                      ["Therapist", patient.therapist_name],
                      ["Package", patient.package_name],
                      ["Status", statusLabel(patient.status)],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs uppercase tracking-wide text-text-secondary">
                        {label}
                      </dt>
                      <dd className="mt-1 text-sm text-text-primary">
                        {label === "Status" ? (
                          <StatusPill tone={statusTone(patient.status)}>
                            {value}
                          </StatusPill>
                        ) : label === "Phone" ? (
                          <span className="font-mono text-sm">{value}</span>
                        ) : (
                          value
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ) : null}

            {tab === "sessions" ? (
              <Card className="overflow-hidden p-0">
                <div className="border-b border-border px-5 py-4">
                  <CardTitle>Session history</CardTitle>
                </div>
                {patient.sessions.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-text-secondary">
                    No appointments yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="border-b border-border bg-background/80 text-xs uppercase tracking-wide text-text-secondary">
                        <tr>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Time</th>
                          <th className="px-4 py-3 font-medium">Therapist</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patient.sessions.map((s) => (
                          <tr
                            key={s.id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-4 py-3 font-mono text-xs">
                              {s.appointment_date}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">
                              {s.start_time}–{s.end_time}
                            </td>
                            <td className="px-4 py-3">{s.therapist_name}</td>
                            <td className="px-4 py-3">
                              <StatusPill tone={sessionTone(s.status)}>
                                {s.status.replace("_", " ")}
                              </StatusPill>
                            </td>
                            <td className="px-4 py-3 text-text-secondary">
                              {s.notes || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ) : null}

            {tab === "billing" ? (
              <Card className="overflow-hidden p-0">
                <div className="border-b border-border px-5 py-4">
                  <CardTitle>Billing history</CardTitle>
                </div>
                {patient.invoices.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-text-secondary">
                    No invoices yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="border-b border-border bg-background/80 text-xs uppercase tracking-wide text-text-secondary">
                        <tr>
                          <th className="px-4 py-3 font-medium">Invoice</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                          <th className="px-4 py-3 font-medium">Package</th>
                          <th className="px-4 py-3 font-medium">Amount</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patient.invoices.map((inv) => (
                          <tr
                            key={inv.id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-4 py-3 font-mono text-xs">
                              {inv.invoice_number}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs">
                              {inv.issued_on}
                            </td>
                            <td className="px-4 py-3">{inv.package_name}</td>
                            <td className="px-4 py-3 font-mono">
                              {Number(inv.net_amount).toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <StatusPill tone={invoiceTone(inv.status)}>
                                {inv.status}
                              </StatusPill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            ) : null}
          </>
        )}
      </div>

      {patient ? (
        <PatientFormModal
          open={formOpen}
          patient={patient}
          therapists={therapists}
          packages={packages}
          onClose={() => setFormOpen(false)}
          onSubmit={handleUpdate}
        />
      ) : null}
    </>
  );
}
