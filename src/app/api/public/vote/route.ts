import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase";
import type { Gender } from "@/lib/types";

function isValidDevice(value: string | undefined): value is Gender {
  return value === "putra" || value === "putri";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    session_id?: string;
    participant_id?: string;
    candidate_id?: string;
    device?: string;
  };

  if (!body.session_id || !body.participant_id || !body.candidate_id) {
    return NextResponse.json(
      { error: "session_id, participant_id, dan candidate_id wajib ada." },
      { status: 400 }
    );
  }

  try {
    const supabase = createServiceSupabaseClient();
    const { data, error } = await supabase.rpc("submit_vote", {
      p_session_id: body.session_id,
      p_participant_id: body.participant_id,
      p_candidate_id: body.candidate_id
    });

    if (error) throw new Error(error.message);

    if (isValidDevice(body.device)) {
      await supabase
        .from("voting_devices_state")
        .upsert(
          {
            device_type: body.device,
            session_id: null,
            participant_id: null,
            status: "idle",
            updated_at: new Date().toISOString()
          },
          { onConflict: "device_type" }
        );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal menyimpan suara." },
      { status: 400 }
    );
  }
}
