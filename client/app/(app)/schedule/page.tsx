import { AppTopBar } from "@/components/layout/AppTopBar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function SchedulePage() {
  return (
    <>
      <AppTopBar
        title="Schedule"
        description="Therapist columns and time-slot rows for the selected date"
        actions={<Button>Book appointment</Button>}
      />
      <div className="p-6">
        <Card>
          <p className="text-sm text-text-secondary">
            Calendar / slot grid UI base — booking flows come next.
          </p>
        </Card>
      </div>
    </>
  );
}
