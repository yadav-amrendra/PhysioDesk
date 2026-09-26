"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2, Eye } from "lucide-react";
import { PatientFormModal } from "@/components/patients/PatientFormModal";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { Select } from "@/components/ui/Select";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  ApiError,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  type Package,
  type Paginated,
  type Patient,
  type PatientPayload,
  type PatientStatus,
  type Therapist,
} from "@/lib/api";

const PAGE_SIZE = 20;

function statusTone(status: PatientStatus): "success" | "neutral" | "danger" {
  if (status === "active") return "success";
  if (status === "on_hold") return "neutral";
  return "neutral";
}

function statusLabel(status: PatientStatus): string {
  if (status === "on_hold") return "On hold";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function PatientsPageClient() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [query, setQuery] = useState("");
  const [therapistFilter, setTherapistFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState<Patient | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const loadLookups = useCallback(async () => {
    const [tPage, pRows] = await Promise.all([
      apiGet<Paginated<Therapist>>("/api/v1/therapists?page_size=100", true),
      apiGet<Package[]>("/api/v1/packages", true),
    ]);
    setTherapists(tPage.items);
    setPackages(pRows);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));
      if (query.trim()) params.set("q", query.trim());
      if (therapistFilter) params.set("therapist_id", therapistFilter);
      if (statusFilter) params.set("status", statusFilter);
      const result = await apiGet<Paginated<Patient>>(
        `/api/v1/patients?${params.toString()}`,
        true,
      );
      setPatients(result.items);
      setTotal(result.total);
      setTotalPages(result.total_pages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load patients");
    } finally {
      setLoading(false);
    }
  }, [query, therapistFilter, statusFilter, page]);

  useEffect(() => {
    void loadLookups().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load lookups");
    });
  }, [loadLookups]);

  useEffect(() => {
    setPage(1);
  }, [query, therapistFilter, statusFilter]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(handle);
  }, [load]);

  async function handleCreate(payload: PatientPayload) {
    await apiPost<Patient>("/api/v1/patients", payload, true);
    await load();
  }

  async function handleUpdate(payload: PatientPayload) {
    if (!editing) return;
    await apiPatch<Patient>(`/api/v1/patients/${editing.id}`, payload, true);
    await load();
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    setConfirmBusy(true);
    try {
      await apiDelete(`/api/v1/patients/${deleting.id}`, true);
      setDeleting(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete patient");
      setDeleting(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <>
      <AppTopBar
        title="Patients"
        description="Search, filter, and manage patient records"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add patient
          </Button>
        }
      />

      <div className="space-y-4 p-6">
        <Card className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="Search"
              placeholder="Name or phone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="min-w-[180px]">
            <Select
              label="Therapist"
              value={therapistFilter}
              onChange={(e) => setTherapistFilter(e.target.value)}
            >
              <option value="">All therapists</option>
              {therapists.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="completed">Completed</option>
            </Select>
          </div>
        </Card>

        {error ? (
          <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-border bg-background/80 text-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Condition</th>
                  <th className="px-4 py-3 font-medium">Therapist</th>
                  <th className="px-4 py-3 font-medium">Package</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-text-secondary">
                      Loading patients…
                    </td>
                  </tr>
                ) : patients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-text-secondary">
                      No patients found.
                    </td>
                  </tr>
                ) : (
                  patients.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/patients/${p.id}`}
                          className="font-medium text-text-primary hover:text-primary"
                        >
                          {p.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                        {p.phone}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{p.condition}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {p.therapist_name}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{p.package_name}</td>
                      <td className="px-4 py-3">
                        <StatusPill tone={statusTone(p.status)}>
                          {statusLabel(p.status)}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/patients/${p.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-border text-text-primary hover:bg-primary-soft/60"
                            title="View profile"
                          >
                            <Eye className="h-4 w-4 shrink-0" />
                          </Link>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 px-0"
                            title="Edit"
                            onClick={() => {
                              setEditing(p);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4 shrink-0" />
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 px-0 text-status-danger"
                            title="Delete"
                            onClick={() => setDeleting(p)}
                          >
                            <Trash2 className="h-4 w-4 shrink-0" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
            disabled={loading}
          />
        </Card>
      </div>

      <PatientFormModal
        open={formOpen}
        patient={editing}
        therapists={therapists}
        packages={packages}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={editing ? handleUpdate : handleCreate}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete patient?"
        description={
          deleting
            ? `Delete ${deleting.full_name}? Their appointments will be removed. Patients with invoices cannot be deleted.`
            : ""
        }
        confirmLabel="Delete"
        busy={confirmBusy}
        onClose={() => {
          if (!confirmBusy) setDeleting(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </>
  );
}
