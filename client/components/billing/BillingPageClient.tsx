"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Printer, Trash2 } from "lucide-react";
import { InvoiceFormModal } from "@/components/billing/InvoiceFormModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  ApiError,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  type Invoice,
  type InvoicePayload,
  type InvoiceUpdatePayload,
  type Package,
  type Patient,
} from "@/lib/api";

function money(value: string | number): string {
  return Number(value).toFixed(2);
}

export function BillingPageClient() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      const qs = params.toString();
      const [rows, patientRows, packageRows] = await Promise.all([
        apiGet<Invoice[]>(`/api/v1/invoices${qs ? `?${qs}` : ""}`, true),
        apiGet<Patient[]>("/api/v1/patients", true),
        apiGet<Package[]>("/api/v1/packages", true),
      ]);
      setInvoices(rows);
      setPatients(patientRows);
      setPackages(packageRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 200);
    return () => window.clearTimeout(handle);
  }, [load]);

  async function handleCreate(payload: InvoicePayload) {
    await apiPost<Invoice>("/api/v1/invoices", payload, true);
    await load();
  }

  async function handleUpdate(payload: InvoiceUpdatePayload) {
    if (!editing) return;
    await apiPatch<Invoice>(`/api/v1/invoices/${editing.id}`, payload, true);
    await load();
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    setConfirmBusy(true);
    try {
      await apiDelete(`/api/v1/invoices/${deleting.id}`, true);
      setDeleting(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete invoice");
      setDeleting(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  async function markPaid(invoice: Invoice) {
    try {
      await apiPatch<Invoice>(
        `/api/v1/invoices/${invoice.id}`,
        { status: "paid" },
        true,
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark as paid");
    }
  }

  function printInvoice(invoice: Invoice) {
    const escape = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escape(invoice.invoice_number)}</title>
  <style>
    body { font-family: Georgia, "Times New Roman", serif; padding: 40px; color: #1c2622; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    .muted { color: #797365; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { text-align: left; padding: 8px 0; border-bottom: 1px solid #e4dfd1; }
    .total { font-size: 20px; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <h1>PhysioDesk</h1>
  <p class="muted">Invoice ${escape(invoice.invoice_number)}</p>
  <p>
    <strong>Patient:</strong> ${escape(invoice.patient_name)}<br/>
    <strong>Issued:</strong> ${escape(invoice.issued_on)}<br/>
    <strong>Status:</strong> ${escape(invoice.status)}
  </p>
  <table>
    <thead><tr><th>Service</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>${escape(invoice.package_name)}</td><td>${money(invoice.amount)}</td></tr>
      <tr><td>Discount</td><td>-${money(invoice.discount)}</td></tr>
    </tbody>
  </table>
  <p class="total">Net due: ${money(invoice.net_amount)}</p>
  <p class="muted">Payment: ${escape(invoice.payment_method)}${
      invoice.notes ? ` · ${escape(invoice.notes)}` : ""
    }</p>
</body>
</html>`;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    const frameDoc = iframe.contentDocument ?? frameWindow?.document;
    if (!frameWindow || !frameDoc) {
      document.body.removeChild(iframe);
      setError("Could not open print preview. Check popup blockers.");
      return;
    }

    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    const cleanup = () => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    };

    // Give the iframe a tick to layout, then print
    window.setTimeout(() => {
      try {
        frameWindow.focus();
        frameWindow.print();
      } finally {
        window.setTimeout(cleanup, 500);
      }
    }, 100);
  }

  return (
    <>
      <AppTopBar
        title="Billing"
        description={
          isAdmin
            ? "Invoices with Paid / Due status filters"
            : "Invoice list (read-only for staff)"
        }
        actions={
          isAdmin ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Create bill
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-4 p-6">
        <Card className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input
              label="Search"
              placeholder="Invoice #, patient, or package"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="min-w-[160px]">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="paid">Paid</option>
              <option value="due">Due</option>
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
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-text-secondary">
                      Loading invoices…
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-text-secondary">
                      No invoices found.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-mono text-xs">
                        {inv.invoice_number}
                      </td>
                      <td className="px-4 py-3 font-medium">{inv.patient_name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{inv.issued_on}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {inv.package_name}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {money(inv.net_amount)}
                        {Number(inv.discount) > 0 ? (
                          <span className="ml-1 text-xs text-text-secondary">
                            (disc {money(inv.discount)})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill
                          tone={inv.status === "paid" ? "success" : "danger"}
                        >
                          {inv.status === "paid" ? "Paid" : "Due"}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <Button
                            variant="ghost"
                            className="h-8 w-8 px-0"
                            title="Print"
                            onClick={() => printInvoice(inv)}
                          >
                            <Printer className="h-4 w-4 shrink-0" />
                          </Button>
                          {isAdmin ? (
                            <>
                              {inv.status === "due" ? (
                                <Button
                                  variant="ghost"
                                  className="h-8 px-2 text-xs"
                                  onClick={() => void markPaid(inv)}
                                >
                                  Mark paid
                                </Button>
                              ) : null}
                              <Button
                                variant="ghost"
                                className="h-8 w-8 px-0"
                                title="Edit"
                                onClick={() => {
                                  setEditing(inv);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4 shrink-0" />
                              </Button>
                              <Button
                                variant="ghost"
                                className="h-8 w-8 px-0 text-status-danger"
                                title="Delete"
                                onClick={() => setDeleting(inv)}
                              >
                                <Trash2 className="h-4 w-4 shrink-0" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {isAdmin ? (
        <InvoiceFormModal
          open={formOpen}
          invoice={editing}
          patients={patients}
          packages={packages}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title="Void invoice?"
        description={
          deleting
            ? `Delete ${deleting.invoice_number} for ${deleting.patient_name}? This cannot be undone.`
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
