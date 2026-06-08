import { NextResponse } from "next/server";
import { buildPublicOverview, fetchElectionSnapshot } from "@/lib/server-data";

export async function GET() {
  try {
    const snapshot = await fetchElectionSnapshot();
    return NextResponse.json(buildPublicOverview(snapshot));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat display." },
      { status: 500 }
    );
  }
}
