import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, isDatabaseConfigured } from "@/server/db";
import { checkHealth } from "@/server/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { httpStatus, body } = await checkHealth({
    ping: isDatabaseConfigured() ? async () => void (await getDb().execute(sql`select 1`)) : null,
    production: process.env.NODE_ENV === "production",
  });
  return NextResponse.json(body, { status: httpStatus, headers: { "cache-control": "no-store" } });
}
