"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import type {
  Invoice,
  InvoicePayload,
  InvoiceStatus,
  InvoiceUpdatePayload,
  Package,
  Patient,
  PaymentMethod,
} from "@/lib/api";

type FormState = {
  patient_id: string;
  package_id: string;
  amount: string;
  discount: string;
  status: InvoiceStatus;
  payment_method: PaymentMethod;
  issued_on: string;
  notes: string;
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function InvoiceFormModal({
  open,
  invoice,
  patients,
  packages,
  onClose,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  invoice: Invoice | null;
  patients: Patient[];
  packages: Package[];
  onClose: () => void;
  onCreate: (payload: InvoicePayload) => Promise<void>;
  onUpdate: (payload: InvoiceUpdatePayload) => Promise<void>;
}) {
  const isEdit = invoice !== null;
  const [form, setForm] = useState<FormState>({
    patient_id: "",
    package_id: "",
    amount: "",
    discount: "0",
    status: "due",
    payment_method: "cash",
    issued_on: todayISO(),
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (invoice) {
      setForm({
        patient_id: String(invoice.patient_id),
        package_id: String(invoice.package_id),
        amount: String(invoice.amount),
        discount: String(invoice.discount),
        status: invoice.status,
        payment_method: invoice.payment_method,
        issued_on: invoice.issued_on,
        notes: invoice.notes ?? "",
      });
      return;
    }
    const firstPkg = packages[0];
    setForm({
      patient_id: patients[0] ? String(patients[0].id) : "",
      package_id: firstPkg ? String(firstPkg.id) : "",
      amount: firstPkg ? String(firstPkg.price) : "",
      discount: "0",
      status: "due",
      payment_method: "cash",
      issued_on: todayISO(),
      notes: "",
    });
  }, [open, invoice, patients, packages]);

  function onPackageChange(packageId: string) {
    const pkg = packages.find((p) => String(p.id) === packageId);
    setForm((f) => ({
      ...f,
      package_id: packageId,
      amount: pkg ? String(pkg.price) : f.amount,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patient_id || !form.package_id) {
      setError("Patient and package are required.");
      return;
    }
    const amount = Number(form.amount);
    const discount = Number(form.discount || 0);
    if (Number.isNaN(amount) || amount < 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (Number.isNaN(discount) || discount < 0 || discount > amount) {
      setError("Discount must be between 0 and amount.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await onUpdate({
          package_id: Number(form.package_id),
          amount,
          discount,
          status: form.status,
          payment_method: form.payment_method,
          issued_on: form.issued_on,
          notes: form.notes.trim() || null,
        });
      } else {
        await onCreate({
          patient_id: Number(form.patient_id),
          package_id: Number(form.package_id),
          amount,
          discount,
          status: form.status,
          payment_method: form.payment_method,
          issued_on: form.issued_on,
          notes: form.notes.trim() || null,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save invoice");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit invoice" : "Create bill"}
      description="Patient, package, discount, and payment status"
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isEdit ? (
          <p className="font-mono text-sm text-text-secondary">
            {invoice.invoice_number} · {invoice.patient_name}
          </p>
        ) : (
          <Select
            label="Patient"
            value={form.patient_id}
            onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}
            required
          >
            <option value="" disabled>
              Select patient
            </option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </Select>
        )}

        <Select
          label="Package / service"
          value={form.package_id}
          onChange={(e) => onPackageChange(e.target.value)}
          required
        >
          <option value="" disabled>
            Select package
          </option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({Number(p.price).toFixed(2)})
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Amount"
            type="number"
            min={0}
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            required
          />
          <Input
            label="Discount"
            type="number"
            min={0}
            step="0.01"
            value={form.discount}
            onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Status"
            value={form.status}
            onChange={(e) =>
              setForm((f) => ({ ...f, status: e.target.value as InvoiceStatus }))
            }
          >
            <option value="due">Due</option>
            <option value="paid">Paid</option>
          </Select>
          <Select
            label="Payment method"
            value={form.payment_method}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                payment_method: e.target.value as PaymentMethod,
              }))
            }
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="insurance">Insurance</option>
            <option value="other">Other</option>
          </Select>
        </div>

        <Input
          label="Issued on"
          type="date"
          value={form.issued_on}
          onChange={(e) => setForm((f) => ({ ...f, issued_on: e.target.value }))}
          required
        />
        <Input
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />

        {error ? (
          <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create bill"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
