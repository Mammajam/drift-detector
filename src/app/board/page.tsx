import type { Metadata } from "next";
import Link from "next/link";
import { loadDemoData } from "@/app/actions";
import { RouteBuilds } from "@/components/board/RouteBuilds";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import buttons from "@/components/ui/buttons.module.css";
import { getSession } from "@/server/auth";
import { dbOrNull, projectName } from "@/server/data";
import { getBoard } from "@/server/db/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
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
        <EmptyState
          title="No routes yet"
          action={
            session ? (
              <form action={loadDemoData}>
                <button type="submit" className={buttons.primary}>
                  Load demo data
                </button>
              </form>
            ) : (
              <Link href="/login?next=/board" className={buttons.primary}>
                Sign in to load demo data
              </Link>
            )
          }
        >
          <p>
            Run a capture with <code>POST /api/captures</code> to add a route and its first preview build, or load a
            small demo project to explore the board, tickets and sign-off report.
          </p>
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
