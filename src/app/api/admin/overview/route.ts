import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { buildAdminOverview, fetchElectionSnapshot } from "@/lib/server-data";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const snapshot = await fetchElectionSnapshot();
    return NextResponse.json(buildAdminOverview(snapshot));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat dashboard." },
      { status: 500 }
    );
  }
}
