import type { Metadata } from "next";
import { LoginForm } from "@/components/login/LoginForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { signInEnabled } from "@/server/auth";
import { safeNextPath } from "@/server/auth-token";

export const metadata: Metadata = { title: "Sign in · Drift Detector" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  if (!signInEnabled()) {
    return (
      <>
        <PageHeader title="Sign in" />
        <EmptyState title="Sign-in isn't set up here">
          <p>
            Everything is read-only until an <code>APP_PASSCODE</code> is set for this deployment. Browsing the board,
            tickets, reports and inspector still works.
          </p>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Sign in"
        description="Sign in to change drift statuses, approve builds and run live captures. Reading is open to everyone."
      />
      <LoginForm next={safeNextPath(next)} needsPasscode={Boolean(process.env.APP_PASSCODE)} />
    </>
  );
}
