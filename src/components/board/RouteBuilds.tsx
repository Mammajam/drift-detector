import Link from "next/link";
import type { BoardRoute } from "@/lib/types";
import { buildLabel, formatDateTime, inspectorHref } from "@/lib/format";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import buttons from "@/components/ui/buttons.module.css";
import styles from "./RouteBuilds.module.css";

/** One route: a table of its preview builds, newest first. */
export function RouteBuilds({ route }: { route: BoardRoute }) {
  const headingId = `route-${route.id}`;

  return (
    <section aria-labelledby={headingId} className={styles.route}>
      <div className={styles.head}>
        <h2 id={headingId} className={styles.path}>
          {route.path}
        </h2>
        <Link href={`/report/${route.id}`} className={buttons.secondary}>
          Sign-off report<span className="sr-only"> for {route.path}</span>
        </Link>
      </div>

      <div className={styles.scroll} role="region" aria-label={`Builds of ${route.path}`} tabIndex={0}>
        <table className={styles.table} role="table">
          <caption className="sr-only">Preview builds of {route.path}, newest first</caption>
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">Build</th>
              <th scope="col" role="columnheader">Captured</th>
              <th scope="col" role="columnheader">Captures</th>
              <th scope="col" role="columnheader">Open drifts</th>
              <th scope="col" role="columnheader">Drift score</th>
              <th scope="col" role="columnheader">Sign-off</th>
              <th scope="col" role="columnheader">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {route.builds.map((build, index) => (
              <tr key={build.previewUrl} role="row">
                <th scope="row" role="rowheader">
                  <span className={styles.build}>{buildLabel(build.previewUrl, build.pullRequestUrl)}</span>
                  {index === 0 ? <span className={styles.latest}>Latest</span> : null}
                  {build.commitSha ? <span className={styles.sha}>{build.commitSha.slice(0, 7)}</span> : null}
                </th>
                <td role="cell" data-label="Captured">{formatDateTime(build.createdAt)}</td>
                <td role="cell" data-label="Captures">{build.captureCount}</td>
                <td role="cell" data-label="Open drifts">
                  <span className={styles.mono}>{build.openDrifts}</span>
                  <span className={styles.resolved}>
                    {" "}
                    · {build.fixedDrifts} fixed · {build.wontFixDrifts} won&apos;t fix
                  </span>
                </td>
                <td role="cell" data-label="Drift score">
                  <ScoreBadge score={build.score} />
                </td>
                <td role="cell" data-label="Sign-off">
                  {build.signedOffBy ? (
                    <span className={styles.signed}>
                      <span aria-hidden="true">✓ </span>
                      {build.signedOffBy}
                    </span>
                  ) : (
                    <span className={styles.muted}>Not signed off</span>
                  )}
                </td>
                <td role="cell" data-label="">
                  <Link href={inspectorHref(route.path, build.previewUrl)} className={styles.inspect}>
                    Inspect<span className="sr-only"> {buildLabel(build.previewUrl, build.pullRequestUrl)} of {route.path}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
