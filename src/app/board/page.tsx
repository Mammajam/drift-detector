import type { Metadata } from "next";
import Link from "next/link";
import { loadDemoData } from "@/app/actions";
import { RouteBuilds } from "@/components/board/RouteBuilds";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import buttons from "@/components/ui/buttons.module.css";
import { getSession, signInEnabled } from "@/server/auth";
import { dbOrNull, projectName } from "@/server/data";
import { getBoard } from "@/server/db/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

/** What to offer on an empty board: load demo data, sign in first, or nothing when sign-in doesn't exist. */
function emptyAction(signedIn: boolean, canSignIn: boolean) {
  if (signedIn) {
    return (
      <form action={loadDemoData}>
        <button type="submit" className={buttons.primary}>
          Load demo data
        </button>
      </form>
    );
  }
  if (canSignIn) {
    return (
      <Link href="/login?next=/board" className={buttons.primary}>
        Sign in to load demo data
      </Link>
    );
  }
  return undefined;
}
export const metadata: Metadata = { title: "Project board · Drift Detector" };

export default async function BoardPage() {
  const db = dbOrNull();

  if (!db) {
    return (
      <>
        <PageHeader title="Project board" />
        <EmptyState
          title="No database connected"
          action={
            <Link href="/inspector" className={buttons.secondary}>
              Try the inspector with sample data
            </Link>
          }
        >
          <p>
            The board lists every route and preview build from Postgres. Set <code>DATABASE_URL</code> and run{" "}
            <code>npm run db:migrate</code>, then run a capture.
          </p>
        </EmptyState>
      </>
    );
  }

  const [routes, session] = await Promise.all([getBoard(db, projectName()), getSession()]);

  if (routes.length === 0) {
    return (
      <>
        <PageHeader title="Project board" />
        <EmptyState title="No routes yet" action={emptyAction(Boolean(session), signInEnabled())}>
          <p>
            Run a capture with <code>POST /api/captures</code> to add a route and its first preview build.
          </p>
          {session ? (
            <p>Or load the demo project to explore the board, tickets and sign-off report.</p>
          ) : signInEnabled() ? (
            <p>Sign in to load a small demo project, or to run captures.</p>
          ) : (
            <p>
              Sign-in isn&apos;t set up on this deployment, so demo data can&apos;t be loaded from here. Set{" "}
              <code>SEED_DEMO_ON_START=1</code> and redeploy to load it on start.
            </p>
          )}
        </EmptyState>
      </>
    );
  }

  const latest = routes.flatMap((r) => (r.builds[0] ? [r.builds[0]] : []));
  const stats = [
    { label: "Routes", value: routes.length },
    { label: "Open drifts in latest builds", value: latest.reduce((n, b) => n + b.openDrifts, 0) },
    { label: "Latest builds signed off", value: `${latest.filter((b) => b.signedOffBy).length} / ${latest.length}` },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Project board"
        title={projectName()}
        description="Every route against its preview builds. Open a build in the inspector, or head to the sign-off report to approve it."
      />
      <dl className={styles.stats}>
        {stats.map((s) => (
          <div key={s.label} className={styles.stat}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.routes}>
        {routes.map((route) => (
          <RouteBuilds key={route.id} route={route} />
        ))}
      </div>
    </>
  );
}
