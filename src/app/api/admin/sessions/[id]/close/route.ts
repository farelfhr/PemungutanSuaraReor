import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { createServiceSupabaseClient } from "@/lib/supabase";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase.rpc("close_voting_session", {
      p_session_id: id
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ session: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menutup sesi." },
      { status: 400 }
    );
  }
}
