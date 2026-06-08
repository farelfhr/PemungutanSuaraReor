import { NextResponse } from "next/server";
import {
  canVoteInRunningSession,
  isDeviceAllowedForPosition
} from "@/lib/election";
import { createServiceSupabaseClient } from "@/lib/supabase";
import type {
  Gender,
  Participant,
  Position,
  Vote,
  VotingDeviceState,
  VotingSession
} from "@/lib/types";

type DeviceStatePayload = {
  device?: string;
  session_id?: string | null;
  participant_id?: string | null;
};

function isValidDevice(value: string | undefined): value is Gender {
  return value === "putra" || value === "putri";
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function saveDeviceState(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  state: {
    device_type: Gender;
    session_id: string | null;
    participant_id: string | null;
    status: "idle" | "voting";
  }
) {
  const { data, error } = await supabase
    .from("voting_devices_state")
    .upsert(
      {
        ...state,
        updated_at: new Date().toISOString()
      },
      { onConflict: "device_type" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as VotingDeviceState;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as DeviceStatePayload;

  if (!isValidDevice(body.device)) {
    return jsonError("Device tidak valid.");
  }

  try {
    const supabase = createServiceSupabaseClient();

    if (!body.participant_id) {
      const clearedState = await saveDeviceState(supabase, {
        device_type: body.device,
        session_id: null,
        participant_id: null,
        status: "idle"
      });
      return NextResponse.json({ device_state: clearedState });
    }

    if (!body.session_id) {
      return jsonError("session_id wajib ada untuk aktivasi peserta.");
    }

    const { data: sessionData, error: sessionError } = await supabase
      .from("voting_sessions")
      .select("*")
      .eq("id", body.session_id)
      .maybeSingle();
    if (sessionError) throw new Error(sessionError.message);

    const session = sessionData as VotingSession | null;
    if (!session) return jsonError("Sesi voting tidak ditemukan.", 404);
    if (session.status !== "berjalan") {
      return jsonError("Sesi voting tidak sedang berjalan.");
    }

    const { data: positionData, error: positionError } = await supabase
      .from("positions")
      .select("*")
      .eq("id", session.position_id)
      .maybeSingle();
    if (positionError) throw new Error(positionError.message);

    const position = positionData as Position | null;
    if (!position) return jsonError("Posisi sesi aktif tidak ditemukan.", 404);
    if (!isDeviceAllowedForPosition(body.device, position.eligible_gender)) {
      return jsonError(`Sesi ini hanya untuk pemilih ${position.eligible_gender}.`);
    }

    const { data: participantData, error: participantError } = await supabase
      .from("participants")
      .select("*")
      .eq("id", body.participant_id)
      .maybeSingle();
    if (participantError) throw new Error(participantError.message);

    const participant = participantData as Participant | null;
    if (!participant) return jsonError("Peserta tidak ditemukan.", 404);
    if (participant.gender !== body.device) {
      return jsonError(`Peserta bukan bagian dari laptop voting ${body.device}.`);
    }
    if (!canVoteInRunningSession(participant, position)) {
      return jsonError("Peserta belum hadir atau tidak memiliki hak suara sesi ini.");
    }

    const { data: voteData, error: voteError } = await supabase
      .from("votes")
      .select("id")
      .eq("session_id", body.session_id)
      .eq("participant_id", body.participant_id)
      .maybeSingle();
    if (voteError) throw new Error(voteError.message);

    const existingVote = voteData as Pick<Vote, "id"> | null;
    if (existingVote) return jsonError("Peserta sudah memilih pada sesi ini.", 409);

    const deviceState = await saveDeviceState(supabase, {
      device_type: body.device,
      session_id: body.session_id,
      participant_id: body.participant_id,
      status: "voting"
    });

    return NextResponse.json({ device_state: deviceState });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Gagal mengubah status device.",
      500
    );
  }
}
