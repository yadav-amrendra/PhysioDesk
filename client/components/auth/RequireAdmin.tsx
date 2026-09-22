"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated" && user?.role !== "admin") {
      router.replace("/dashboard");
    }
  }, [status, user, router]);

  if (status !== "authenticated" || user?.role !== "admin") {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-text-secondary">
        Checking permissions…
      </div>
    );
  }

  return children;
}
