import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col bg-background">{children}</div>
    </div>
  );
}
