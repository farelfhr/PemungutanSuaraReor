import { NextResponse } from "next/server";
import {
  applyDeviceVotingStates,
  buildParticipantVoteStatuses,
  getActiveSession,
  isDeviceAllowedForPosition,
  sortSessionsByPosition
} from "@/lib/election";
import { fetchElectionSnapshot } from "@/lib/server-data";
import { createServiceSupabaseClient } from "@/lib/supabase";
import type { Gender, VotingDeviceState } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const device = url.searchParams.get("device") as Gender | null;
  if (device !== "putra" && device !== "putri") {
    return NextResponse.json({ error: "Device tidak valid." }, { status: 400 });
  }

  try {
    const snapshot = await fetchElectionSnapshot();
    const sortedSessions = sortSessionsByPosition(
      snapshot.sessions,
      snapshot.positions
    );
    const activeSession = getActiveSession(sortedSessions);

    if (!activeSession) {
      return NextResponse.json({
        device,
        device_state: null,
        allowed: false,
        message: "Belum ada sesi voting yang dibuka.",
        active_session: null,
        position: null,
        participants: [],
        candidates: []
      });
    }

    const position = snapshot.positions.find(
      (item) => item.id === activeSession.position_id
    );
    if (!position) throw new Error("Posisi sesi aktif tidak ditemukan.");

    const supabase = createServiceSupabaseClient();
    const { data: deviceStateRows, error: deviceStateError } = await supabase
      .from("voting_devices_state")
      .select("*");
    if (deviceStateError) throw new Error(deviceStateError.message);

    const deviceStates = (deviceStateRows ?? []) as VotingDeviceState[];
    const deviceState =
      deviceStates.find((state) => state.device_type === device) ?? null;
    const activeDeviceState =
      deviceState?.status === "voting" && deviceState.session_id === activeSession.id
        ? deviceState
        : null;

    const allowed = isDeviceAllowedForPosition(device, position.eligible_gender);
    const participants = applyDeviceVotingStates(
      buildParticipantVoteStatuses(
        snapshot.participants.filter(
          (participant) => participant.gender === device && participant.is_voter
        ),
        activeSession,
        snapshot.votes
      ),
      deviceStates,
      activeSession
    );

    return NextResponse.json({
      device,
      device_state: activeDeviceState,
      allowed,
      message: allowed
        ? null
        : `Sesi ini hanya untuk pemilih ${position.eligible_gender}.`,
      active_session: activeSession,
      position,
      participants,
      candidates: allowed
        ? snapshot.candidates.filter(
            (candidate) => candidate.position_id === position.id
          )
        : []
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Gagal memuat voting." },
      { status: 500 }
    );
  }
}
