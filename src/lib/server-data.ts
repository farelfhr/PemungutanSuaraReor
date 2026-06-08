import {
  computeSessionSummary,
  getFinalAnnouncements,
  getActiveSession,
  sortSessionsByPosition
} from "@/lib/election";
import { createServiceSupabaseClient } from "@/lib/supabase";
import type {
  Candidate,
  ElectionSnapshot,
  Participant,
  Position,
  SessionSummary,
  Vote,
  VotingSession
} from "@/lib/types";

async function assertNoError<T>(
  result: { data: T | null; error: { message: string } | null },
  label: string
) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data ?? ([] as T);
}

export async function fetchElectionSnapshot(): Promise<ElectionSnapshot> {
  const supabase = createServiceSupabaseClient();

  const [participants, positions, candidates, sessions, votes] = await Promise.all([
    supabase.from("participants").select("*").order("name"),
    supabase.from("positions").select("*").order("order_number"),
    supabase.from("candidates").select("*").order("name"),
    supabase.from("voting_sessions").select("*").order("created_at"),
    supabase.from("votes").select("*").order("created_at")
  ]);

  return {
    participants: await assertNoError<Participant[]>(
      participants,
      "participants"
    ),
    positions: await assertNoError<Position[]>(positions, "positions"),
    candidates: await assertNoError<Candidate[]>(candidates, "candidates"),
    sessions: sortSessionsByPosition(
      await assertNoError<VotingSession[]>(sessions, "voting_sessions"),
      await assertNoError<Position[]>(positions, "positions")
    ),
    votes: await assertNoError<Vote[]>(votes, "votes")
  };
}

export function buildAdminOverview(snapshot: ElectionSnapshot) {
  const sessions: SessionSummary[] = snapshot.sessions.map((session) =>
    computeSessionSummary(snapshot, session, {
      includeResults:
        session.status === "ditutup" || session.status === "hasil_diumumkan"
    })
  );

  return {
    active_session:
      sessions.find((summary) => summary.session.status === "berjalan") ?? null,
    sessions,
    totals: {
      participants: snapshot.participants.length,
      present: snapshot.participants.filter(
        (participant) => participant.attendance_status === "hadir"
      ).length,
      absent: snapshot.participants.filter(
        (participant) => participant.attendance_status === "tidak_hadir"
      ).length,
      not_checked_in: snapshot.participants.filter(
        (participant) => participant.attendance_status === "belum_hadir"
      ).length,
      candidates: snapshot.participants.filter((participant) => participant.is_candidate)
        .length
    },
    final_announcements: getFinalAnnouncements(snapshot),
    generated_at: new Date().toISOString()
  };
}

export function buildPublicOverview(snapshot: ElectionSnapshot) {
  const activeSession = getActiveSession(snapshot.sessions);
  const preferredSessions = activeSession
    ? [activeSession]
    : snapshot.sessions.filter((session) => session.status !== "belum_dibuka");
  const session = preferredSessions.at(-1) ?? snapshot.sessions[0] ?? null;
  const summary = session
    ? computeSessionSummary(snapshot, session, {
        includeResults: session.status === "hasil_diumumkan"
      })
    : null;

  return {
    summary,
    final_announcements: getFinalAnnouncements(snapshot),
    generated_at: new Date().toISOString()
  };
}
