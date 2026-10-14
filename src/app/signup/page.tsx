import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/login/SignupForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSession, signInEnabled } from "@/server/auth";
import { safeNextPath } from "@/server/auth-token";

export const metadata: Metadata = { title: "Create account · Drift Detector" };
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNextPath(next);

  if (!signInEnabled()) {
    return (
      <>
        <PageHeader title="Create account" />
        <EmptyState title="Accounts aren't set up here">
          <p>
            Everything is read-only until <code>AUTH_SECRET</code> and <code>DATABASE_URL</code> are set for this
            deployment. Browsing the board, tickets, reports and inspector still works.
          </p>
        </EmptyState>
      </>
    );
  }

  if (await getSession()) redirect(target === "/" ? "/board" : target);

  return (
    <>
      <PageHeader
        title="Create account"
        description="An account lets you change drift statuses, approve builds and run live captures. Reading is open to everyone."
      />
      <SignupForm next={target} />
    </>
  );
}
