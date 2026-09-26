"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { appNav } from "@/lib/nav";
import { cn } from "@/lib/cn";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, logoutEverywhere } = useAuth();

  const links = appNav.filter((item) => {
    if (item.href === "/therapists") {
      return user?.role === "admin";
    }
    return true;
  });

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  async function onLogoutEverywhere() {
    await logoutEverywhere();
    router.replace("/login");
  }

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-secondary text-white">
      <div className="border-b border-white/10 px-5 py-6">
        <Link href="/dashboard" className="block">
          <p className="font-display text-2xl font-semibold tracking-tight">
            PhysioDesk
          </p>
          <p className="mt-1 text-xs text-white/60">Clinic management</p>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {links.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-white"
                  : "text-white/75 hover:bg-secondary-light hover:text-white",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        {user ? (
          <div className="mb-3">
            <p className="truncate text-sm font-medium text-white">
              {user.full_name}
            </p>
            <p className="truncate text-xs capitalize text-white/50">
              {user.role}
            </p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void onLogout()}
          className="w-full rounded-[10px] px-3 py-2 text-left text-sm text-white/70 transition-colors hover:bg-secondary-light hover:text-white"
        >
          Sign out
        </button>
        <button
          type="button"
          onClick={() => void onLogoutEverywhere()}
          className="mt-1 w-full rounded-[10px] px-3 py-2 text-left text-xs text-white/45 transition-colors hover:bg-secondary-light hover:text-white/80"
        >
          Sign out everywhere
        </button>
      </div>
    </aside>
  );
}
