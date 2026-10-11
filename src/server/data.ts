import "server-only";
import { getDb, isDatabaseConfigured } from "./db";

export const projectName = () => process.env.PROJECT_NAME ?? "Drift Detector";

/** The database handle, or null when DATABASE_URL isn't set (pages then show setup help). */
export const dbOrNull = () => (isDatabaseConfigured() ? getDb() : null);

export const rollbackUrl = () => process.env.DEPLOYXA_ROLLBACK_URL ?? "https://deployxa.com/dashboard/deployments";
