import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { createServiceSupabaseClient } from "@/lib/supabase";
import type { AttendanceStatus } from "@/lib/types";

const ATTENDANCE_VALUES: AttendanceStatus[] = [
  "belum_hadir",
  "hadir",
  "tidak_hadir"
];

async function requireAdmin() {
  const admin = await getAdminSession();
  return Boolean(admin);
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("participants")
      .select("*")
      .order("name");
    if (error) throw new Error(error.message);
    return NextResponse.json({ participants: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat peserta." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    patch?: Partial<{
      attendance_status: AttendanceStatus;
      is_candidate: boolean;
      is_voter: boolean;
    }>;
  };

  if (!body.id || !body.patch) {
    return NextResponse.json({ error: "Payload peserta tidak lengkap." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (
    body.patch.attendance_status &&
    ATTENDANCE_VALUES.includes(body.patch.attendance_status)
  ) {
    patch.attendance_status = body.patch.attendance_status;
  }
  if (typeof body.patch.is_candidate === "boolean") {
    patch.is_candidate = body.patch.is_candidate;
  }
  if (typeof body.patch.is_voter === "boolean") {
    patch.is_voter = body.patch.is_voter;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan valid." }, { status: 400 });
  }

  try {
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("participants")
      .update(patch)
      .eq("id", body.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ participant: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengubah peserta." },
      { status: 500 }
    );
  }
}
