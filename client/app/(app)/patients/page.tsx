import { AppTopBar } from "@/components/layout/AppTopBar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function PatientsPage() {
  return (
    <>
      <AppTopBar
        title="Patients"
        description="Search, filter, and manage patient records"
        actions={<Button>Add patient</Button>}
      />
      <div className="p-6">
        <Card>
          <div className="mb-4 flex flex-wrap gap-3">
            <input
              placeholder="Search by name or phone"
              className="h-10 min-w-[220px] flex-1 rounded-[10px] border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <select className="h-10 rounded-[10px] border border-border bg-surface px-3 text-sm text-text-primary">
              <option>All therapists</option>
            </select>
            <select className="h-10 rounded-[10px] border border-border bg-surface px-3 text-sm text-text-primary">
              <option>All statuses</option>
            </select>
          </div>
          <p className="text-sm text-text-secondary">
            Patient table will connect to the API next.
          </p>
        </Card>
      </div>
    </>
  );
}
