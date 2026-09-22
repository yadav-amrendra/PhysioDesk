import { AppTopBar } from "@/components/layout/AppTopBar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";

export default function BillingPage() {
  return (
    <>
      <AppTopBar
        title="Billing"
        description="Invoices with Paid / Due status filters"
        actions={<Button>Create bill</Button>}
      />
      <div className="p-6">
        <Card>
          <div className="mb-4 flex gap-2">
            <StatusPill tone="success">Paid</StatusPill>
            <StatusPill tone="danger">Due</StatusPill>
            <StatusPill tone="neutral">Pending</StatusPill>
          </div>
          <p className="text-sm text-text-secondary">
            Invoice list and filters will plug into billing APIs next.
          </p>
        </Card>
      </div>
    </>
  );
}
