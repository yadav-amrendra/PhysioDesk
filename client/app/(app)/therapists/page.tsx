import { RequireAdmin } from "@/components/auth/RequireAdmin";
import { TherapistsPageClient } from "@/components/therapists/TherapistsPageClient";

export default function TherapistsPage() {
  return (
    <RequireAdmin>
      <TherapistsPageClient />
    </RequireAdmin>
  );
}
