import { PatientDetailClient } from "@/components/patients/PatientDetailClient";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const patientId = Number(id);
  return <PatientDetailClient patientId={Number.isFinite(patientId) ? patientId : 0} />;
}
