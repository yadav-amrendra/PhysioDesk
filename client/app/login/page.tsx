import { Card, CardTitle } from "@/components/ui/Card";
import { LoginForm } from "@/components/auth/LoginForm";
import { RedirectIfAuthenticated } from "@/components/auth/RequireAuth";

export default function LoginPage() {
  return (
    <RedirectIfAuthenticated>
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <Card className="w-full max-w-md">
          <div className="mb-8">
            <p className="font-display text-3xl font-semibold text-text-primary">
              PhysioDesk
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Sign in to manage the clinic desk
            </p>
          </div>

          <LoginForm />

          <div className="mt-6 rounded-[10px] bg-primary-soft px-3 py-3 text-xs text-primary-text-on-soft">
            <CardTitle className="mb-1 text-sm">Demo accounts</CardTitle>
            <p className="font-mono">admin@physiodesk.com / Admin123!</p>
            <p className="mt-1 font-mono">staff@physiodesk.com / Staff123!</p>
          </div>
        </Card>
      </div>
    </RedirectIfAuthenticated>
  );
}
