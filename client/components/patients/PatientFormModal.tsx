"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import type {
  Package,
  Patient,
  PatientGender,
  PatientPayload,
  PatientStatus,
  Therapist,
} from "@/lib/api";

type FormState = {
  full_name: string;
  phone: string;
  age: number;
  gender: PatientGender;
  address: string;
  condition: string;
  therapist_id: string;
  package_id: string;
  status: PatientStatus;
};

const emptyForm: FormState = {
  full_name: "",
  phone: "",
  age: 30,
  gender: "unspecified",
  address: "",
  condition: "",
  therapist_id: "",
  package_id: "",
  status: "active",
};

function fromPatient(p: Patient): FormState {
  return {
    full_name: p.full_name,
    phone: p.phone,
    age: p.age,
    gender: p.gender,
    address: p.address,
    condition: p.condition,
    therapist_id: String(p.therapist_id),
    package_id: String(p.package_id),
    status: p.status,
  };
}

export function PatientFormModal({
  open,
  patient,
  therapists,
  packages,
  onClose,
  onSubmit,
}: {
  open: boolean;
  patient: Patient | null;
  therapists: Therapist[];
  packages: Package[];
  onClose: () => void;
  onSubmit: (payload: PatientPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = patient !== null;

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (patient) {
      setForm(fromPatient(patient));
      return;
    }
    setForm({
      ...emptyForm,
      therapist_id: therapists[0] ? String(therapists[0].id) : "",
      package_id: packages[0] ? String(packages[0].id) : "",
    });
  }, [open, patient, therapists, packages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.full_name.trim() || !form.phone.trim() || !form.condition.trim()) {
      setError("Name, phone, and condition are required.");
      return;
    }
    if (!form.therapist_id || !form.package_id) {
      setError("Select a therapist and package.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        age: Number(form.age),
        gender: form.gender,
        address: form.address.trim(),
        condition: form.condition.trim(),
        therapist_id: Number(form.therapist_id),
        package_id: Number(form.package_id),
        status: form.status,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save patient");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit patient" : "Add patient"}
      description="Demographics, condition, assigned therapist, and package"
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Full name"
          value={form.full_name}
          onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            required
          />
          <Input
            label="Age"
            type="number"
            min={1}
            max={120}
            value={form.age}
            onChange={(e) => setForm((f) => ({ ...f, age: Number(e.target.value) }))}
            required
          />
        </div>
        <Select
          label="Gender"
          value={form.gender}
          onChange={(e) =>
            setForm((f) => ({ ...f, gender: e.target.value as PatientGender }))
          }
        >
          <option value="unspecified">Unspecified</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </Select>
        <Input
          label="Address"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
        <Input
          label="Condition"
          value={form.condition}
          onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
          required
        />
        <Select
          label="Assigned therapist"
          value={form.therapist_id}
          onChange={(e) => setForm((f) => ({ ...f, therapist_id: e.target.value }))}
          required
        >
          <option value="" disabled>
            Select therapist
          </option>
          {therapists.map((t) => (
            <option key={t.id} value={t.id}>
              {t.full_name} — {t.specialty}
            </option>
          ))}
        </Select>
        <Select
          label="Package"
          value={form.package_id}
          onChange={(e) => setForm((f) => ({ ...f, package_id: e.target.value }))}
          required
        >
          <option value="" disabled>
            Select package
          </option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.session_count} sessions)
            </option>
          ))}
        </Select>
        <Select
          label="Status"
          value={form.status}
          onChange={(e) =>
            setForm((f) => ({ ...f, status: e.target.value as PatientStatus }))
          }
        >
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="completed">Completed</option>
        </Select>

        {error ? (
          <p className="rounded-[10px] bg-status-danger-soft px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add patient"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
