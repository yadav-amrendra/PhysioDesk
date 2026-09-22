import { RequireAdmin } from "@/components/auth/RequireAdmin";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function TherapistsPage() {
  return (
    <RequireAdmin>
      <AppTopBar
        title="Therapists"
        description="Roster, specialties, and working schedules (admin)"
        actions={<Button>Add therapist</Button>}
      />
      <div className="p-6">
        <Card>
          <p className="text-sm text-text-secondary">
            Therapist roster table and schedule overrides will land here.
          </p>
        </Card>
      </div>
    </RequireAdmin>
  );
}
