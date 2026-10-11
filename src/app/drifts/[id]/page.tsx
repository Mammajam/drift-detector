import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceCrop } from "@/components/ticket/EvidenceCrop";
import { StatusForm } from "@/components/ticket/StatusForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { SpecValue } from "@/components/ui/SpecValue";
import buttons from "@/components/ui/buttons.module.css";
import { buildLabel, inspectorHref, themeLabel } from "@/lib/format";
import { getSession } from "@/server/auth";
import { dbOrNull } from "@/server/data";
import { getTicket } from "@/server/db/queries";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Drift ticket · Drift Detector" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = dbOrNull();
  const ticket = db ? await getTicket(db, id) : null;
  if (!ticket) notFound();

  const { drift, capture, route, number } = ticket;
  const session = await getSession();
  const px = {
    x: Math.round(drift.bbox.x * capture.frame.width),
    y: Math.round(drift.bbox.y * capture.frame.height),
    w: Math.round(drift.bbox.w * capture.frame.width),
    h: Math.round(drift.bbox.h * capture.frame.height),
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className={styles.crumbs}>
        <Link href="/">Board</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/report/${route.id}`}>{route.path}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Drift {number}</span>
      </nav>

      <PageHeader
        eyebrow={`${route.path} · ${capture.breakpoint}px · ${themeLabel(capture.theme)}`}
        title={`Drift ${number}: ${drift.label}`}
        actions={
          <Link href={inspectorHref(route.path, capture.previewUrl)} className={buttons.secondary}>
            Open in inspector
          </Link>
        }
      />

      <div className={styles.grid}>
        <section aria-labelledby="spec" className={styles.card}>
          <h2 id="spec" className={styles.cardTitle}>
            Expected vs actual
          </h2>
          <SpecValue expected={drift.expected} actual={drift.actual} size="lg" />
          <dl className={styles.facts}>
            {drift.token ? (
              <div>
                <dt>Design token</dt>
                <dd className={styles.mono}>{drift.token}</dd>
              </div>
            ) : null}
            <div>
              <dt>Region (px)</dt>
              <dd className={styles.mono}>
                x {px.x} · y {px.y} · {px.w}×{px.h}
              </dd>
            </div>
            <div>
              <dt>Build</dt>
              <dd>
                {buildLabel(capture.previewUrl, capture.pullRequestUrl)}
                {capture.commitSha ? <span className={styles.mono}> · {capture.commitSha.slice(0, 7)}</span> : null}
              </dd>
            </div>
            <div>
              <dt>Pull request</dt>
              <dd>
                {capture.pullRequestUrl ? (
                  <a href={capture.pullRequestUrl} target="_blank" rel="noopener noreferrer">
                    {buildLabel(capture.previewUrl, capture.pullRequestUrl)} on GitHub
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  "No pull request linked"
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="resolution" className={styles.card}>
          <h2 id="resolution" className={styles.cardTitle}>
            Resolution
          </h2>
          <StatusForm ticketId={drift.ticketId} status={drift.status} canEdit={Boolean(session)} />
        </section>
      </div>

      <section aria-labelledby="evidence" className={styles.evidence}>
        <h2 id="evidence" className={styles.cardTitle}>
          Evidence
        </h2>
        <div className={styles.crops}>
          <EvidenceCrop capture={capture} drift={drift} variant="design" label="Figma design" />
          <EvidenceCrop capture={capture} drift={drift} variant="build" label="Live build" />
        </div>
      </section>
    </>
  );
}
