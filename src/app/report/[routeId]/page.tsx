import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLink } from "@/components/report/CopyLink";
import { DriftGroups } from "@/components/report/DriftGroups";
import { SignOffForm } from "@/components/report/SignOffForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import buttons from "@/components/ui/buttons.module.css";
import { buildLabel, formatDateTime, inspectorHref } from "@/lib/format";
import { getSession } from "@/server/auth";
import { dbOrNull, projectName, rollbackUrl } from "@/server/data";
import { getReport } from "@/server/db/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign-off report · Drift Detector" };

export default async function ReportPage({ params }: { params: Promise<{ routeId: string }> }) {
  const { routeId } = await params;
  const db = dbOrNull();
  const report = db ? await getReport(db, projectName(), routeId) : null;
  if (!report) notFound();

  const { route, latest, drifts, signoffs } = report;
  const session = await getSession();

  return (
    <>
      <PageHeader
        eyebrow="Sign-off report"
        title={<span className={styles.path}>{route.path}</span>}
        description={
          latest
            ? `Latest build ${buildLabel(latest.previewUrl, latest.pullRequestUrl)}, captured ${formatDateTime(latest.createdAt)}.`
            : "No builds have been captured for this route yet."
        }
        actions={
          <>
            <CopyLink />
            {latest ? (
              <Link href={inspectorHref(route.path, latest.previewUrl)} className={buttons.secondary}>
                Open in inspector
              </Link>
            ) : null}
          </>
        }
      />

      {latest ? (
        <div className={styles.layout}>
          <section aria-labelledby="drifts" className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 id="drifts" className={styles.h2}>
                What drifted
              </h2>
              <ScoreBadge score={latest.score} />
            </div>
            {drifts.length === 0 ? (
              <p className={styles.clean}>
                <span aria-hidden="true">✓ </span>No drift was found in this build.
              </p>
            ) : (
              <DriftGroups drifts={drifts} />
            )}
          </section>

          <div className={styles.side}>
            <section aria-labelledby="approval" className={styles.card}>
              <h2 id="approval" tabIndex={-1} className={styles.h2}>
                Approval
              </h2>
              {latest.signedOffBy ? (
                <p className={styles.signed}>
                  <span aria-hidden="true">✓ </span>Signed off by <strong>{latest.signedOffBy}</strong>.
                </p>
              ) : latest.openDrifts > 0 ? (
                <p>
                  {latest.openDrifts} drift{latest.openDrifts === 1 ? " is" : "s are"} still open. Fix them, or mark them
                  &ldquo;Won&apos;t fix&rdquo; on their tickets, before signing off.
                </p>
              ) : session ? (
                <SignOffForm routeId={route.id} previewUrl={latest.previewUrl} approver={session.name} />
              ) : (
                <p>
                  <Link href={`/login?next=/report/${route.id}`}>Sign in</Link> or{" "}
                  <Link href={`/signup?next=/report/${route.id}`}>create an account</Link> to approve this build.
                </p>
              )}
            </section>

            <section aria-labelledby="history" className={styles.card}>
              <h2 id="history" className={styles.h2}>
                Sign-off history
              </h2>
              {signoffs.length === 0 ? (
                <p className={styles.muted}>No sign-offs yet.</p>
              ) : (
                <ul className={styles.history}>
                  {signoffs.map((s) => (
                    <li key={`${s.previewUrl}-${s.at}-${s.approvedBy}`}>
                      <strong>{s.approvedBy}</strong> approved {buildLabel(s.previewUrl, s.pullRequestUrl)}
                      <span className={styles.muted}> · {formatDateTime(s.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="rollback" className={styles.card}>
              <h2 id="rollback" className={styles.h2}>
                Something wrong in production?
              </h2>
              <p className={styles.muted}>
                Deployxa can roll production back to the last build that was signed off.
              </p>
              <a href={rollbackUrl()} target="_blank" rel="noopener noreferrer" className={buttons.secondary}>
                Roll back on Deployxa<span className="sr-only"> (opens in a new tab)</span>
              </a>
            </section>
          </div>
        </div>
      ) : (
        <p className={styles.muted}>Run a capture for this route to start a report.</p>
      )}
    </>
  );
}
