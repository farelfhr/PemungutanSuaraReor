import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { cleanText } from "@/lib/election";
import type { Gender } from "@/lib/types";

async function requireAdmin() {
  const admin = await getAdminSession();
  return Boolean(admin);
}

async function loadCandidateContext() {
  const supabase = createServiceSupabaseClient();
  const [positions, candidates, participants] = await Promise.all([
    supabase.from("positions").select("*").order("order_number"),
    supabase.from("candidates").select("*").order("name"),
    supabase.from("participants").select("*").order("name")
  ]);

  if (positions.error) throw new Error(positions.error.message);
  if (candidates.error) throw new Error(candidates.error.message);
  if (participants.error) throw new Error(participants.error.message);

  return {
    positions: positions.data,
    candidates: candidates.data,
    participants: participants.data
  };
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await loadCandidateContext());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat kandidat." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    gender?: Gender | null;
    participant_id?: string | null;
    position_id?: string;
  };

  if (!body.position_id) {
    return NextResponse.json({ error: "Posisi wajib dipilih." }, { status: 400 });
  }

  try {
    const supabase = createServiceSupabaseClient();
    let name = cleanText(body.name);
    let gender = body.gender ?? null;
    const participantId = body.participant_id || null;

    if (participantId) {
      const { data: participant, error } = await supabase
        .from("participants")
        .select("id,name,gender")
        .eq("id", participantId)
        .single();
      if (error) throw new Error(error.message);
      name = participant.name;
      gender = participant.gender;
    }

    if (!name) {
      return NextResponse.json({ error: "Nama kandidat wajib diisi." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("candidates")
      .insert({
        name,
        gender,
        participant_id: participantId,
        position_id: body.position_id
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ candidate: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menambah kandidat." },
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
    name?: string;
    gender?: Gender | null;
    participant_id?: string | null;
    position_id?: string;
  };
  if (!body.id) {
    return NextResponse.json({ error: "ID kandidat wajib ada." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = cleanText(body.name);
  if (body.gender !== undefined) patch.gender = body.gender;
  if (body.participant_id !== undefined) {
    patch.participant_id = body.participant_id || null;
  }
  if (body.position_id !== undefined) patch.position_id = body.position_id;

  try {
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase
      .from("candidates")
      .update(patch)
      .eq("id", body.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ candidate: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal mengubah kandidat." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "ID kandidat wajib ada." }, { status: 400 });
  }

  try {
    const supabase = createServiceSupabaseClient();
    const { error } = await supabase.from("candidates").delete().eq("id", body.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menghapus kandidat." },
      { status: 500 }
    );
  }
}
