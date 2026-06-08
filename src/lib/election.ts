import type {
  AttendanceStatus,
  Candidate,
  CandidateResult,
  ElectionSnapshot,
  EligibleGender,
  Gender,
  Participant,
  ParticipantVoteStatus,
  ParticipantWithVoteStatus,
  Position,
  SessionSummary,
  VotingDeviceState,
  VotingSession
} from "@/lib/types";

const INVISIBLE_CHARS = /[\u200e\u200f\u202a-\u202e\ufeff]/g;

export const CANDIDATE_NAMES = [
  "Birgita Dwi Agatha Malau",
  "Ghiyats Muzaki",
  "Lailatul Qodriyah",
  "Alif Setyo Nugroho",
  "Zahra Arifah",
  "Rizky Ekanova",
  "Nina Aristawati",
  "Hanif Mulki Kuninda Pratama"
] as const;

export function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(INVISIBLE_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeName(value: unknown) {
  return cleanText(value).toLocaleLowerCase("id-ID");
}

export function normalizeGender(
  value: unknown,
  dormitory?: unknown
): Gender | null {
  const text = cleanText(value).toLocaleLowerCase("id-ID");
  if (text.includes("laki") || text.includes("putra") || text.includes("astra")) {
    return "putra";
  }
  if (
    text.includes("perempuan") ||
    text.includes("putri") ||
    text.includes("astri")
  ) {
    return "putri";
  }

  const dorm = cleanText(dormitory).toLocaleLowerCase("id-ID");
  if (dorm === "lili") return "putra";
  if (dorm === "dahlia" || dorm === "tulip") return "putri";
  return null;
}

export function toTitleName(value: unknown) {
  const text = cleanText(value).toLocaleLowerCase("id-ID");
  return text.replace(/\S+/g, (word) =>
    word
      .split("-")
      .map((part) =>
        part ? part.charAt(0).toLocaleUpperCase("id-ID") + part.slice(1) : part
      )
      .join("-")
  );
}

export function isEligibleForPosition(
  participant: Pick<Participant, "gender" | "is_voter">,
  eligibleGender: EligibleGender
) {
  if (!participant.is_voter) return false;
  return eligibleGender === "all" || participant.gender === eligibleGender;
}

export function canVoteInRunningSession(
  participant: Pick<Participant, "attendance_status" | "gender" | "is_voter">,
  position: Pick<Position, "eligible_gender">
) {
  return (
    participant.attendance_status === "hadir" &&
    isEligibleForPosition(
      { gender: participant.gender, is_voter: participant.is_voter },
      position.eligible_gender
    )
  );
}

export function isDeviceAllowedForPosition(
  device: Gender,
  eligibleGender: EligibleGender
) {
  return eligibleGender === "all" || eligibleGender === device;
}

export function getVoteStatus(
  participant: Participant,
  votedIds: Set<string>
): ParticipantVoteStatus {
  if (participant.attendance_status === "tidak_hadir") return "tidak_hadir";
  if (participant.attendance_status === "belum_hadir") return "belum_hadir";
  if (votedIds.has(participant.id)) return "sudah_memilih";
  return "belum_memilih";
}

export function buildParticipantVoteStatuses(
  participants: Participant[],
  session: VotingSession | null,
  votes: ElectionSnapshot["votes"]
): ParticipantWithVoteStatus[] {
  const votedIds = new Set(
    session
      ? votes
          .filter((vote) => vote.session_id === session.id)
          .map((vote) => vote.participant_id)
      : []
  );

  return participants.map((participant) => ({
    ...participant,
    vote_status: getVoteStatus(participant, votedIds)
  }));
}

export function applyDeviceVotingStates(
  participants: ParticipantWithVoteStatus[],
  deviceStates: VotingDeviceState[],
  session: VotingSession | null
): ParticipantWithVoteStatus[] {
  if (!session) return participants;

  const activeParticipantIds = new Set(
    deviceStates
      .filter(
        (state) =>
          state.status === "voting" &&
          state.session_id === session.id &&
          state.participant_id
      )
      .map((state) => state.participant_id as string)
  );

  if (activeParticipantIds.size === 0) return participants;

  return participants.map((participant) =>
    participant.vote_status === "belum_memilih" &&
    activeParticipantIds.has(participant.id)
      ? { ...participant, vote_status: "sedang_memilih" }
      : participant
  );
}

export function buildCandidateResults(
  candidates: Candidate[],
  votes: ElectionSnapshot["votes"],
  positionId: string,
  sessionId: string
): CandidateResult[] {
  const sessionVotes = votes.filter((vote) => vote.session_id === sessionId);
  const counts = new Map<string, number>();
  for (const vote of sessionVotes) {
    counts.set(vote.candidate_id, (counts.get(vote.candidate_id) ?? 0) + 1);
  }

  return candidates
    .filter((candidate) => candidate.position_id === positionId)
    .map((candidate) => ({
      candidate_id: candidate.id,
      name: candidate.name,
      gender: candidate.gender,
      votes: counts.get(candidate.id) ?? 0
    }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "id-ID"));
}

export function computeSessionSummary(
  snapshot: ElectionSnapshot,
  session: VotingSession,
  options?: { includeResults?: boolean }
): SessionSummary {
  const position = snapshot.positions.find(
    (item) => item.id === session.position_id
  );
  if (!position) {
    throw new Error(`Position missing for session ${session.id}`);
  }

  const eligibleParticipants = snapshot.participants.filter((participant) =>
    isEligibleForPosition(participant, position.eligible_gender)
  );
  const activeParticipants = eligibleParticipants.filter(
    (participant) => participant.attendance_status === "hadir"
  );
  const voteRows = snapshot.votes.filter((vote) => vote.session_id === session.id);
  const votedIds = new Set(voteRows.map((vote) => vote.participant_id));
  const votedParticipants = activeParticipants.filter((participant) =>
    votedIds.has(participant.id)
  );
  const remainingParticipants = activeParticipants.filter(
    (participant) => !votedIds.has(participant.id)
  );
  const notPresent = eligibleParticipants.filter(
    (participant) => participant.attendance_status === "tidak_hadir"
  ).length;
  const notCheckedIn = eligibleParticipants.filter(
    (participant) => participant.attendance_status === "belum_hadir"
  ).length;

  const activeVoters = activeParticipants.length;
  const votesSubmitted = voteRows.length;
  const remainingVoters = Math.max(activeVoters - votesSubmitted, 0);

  return {
    session,
    position,
    eligible_voters: eligibleParticipants.length,
    active_voters: activeVoters,
    votes_submitted: votesSubmitted,
    remaining_voters: remainingVoters,
    not_present: notPresent,
    not_checked_in: notCheckedIn,
    progress_percent:
      activeVoters === 0 ? 0 : Math.round((votesSubmitted / activeVoters) * 100),
    voted_participants: votedParticipants,
    remaining_participants: remainingParticipants,
    results: options?.includeResults
      ? buildCandidateResults(
          snapshot.candidates,
          snapshot.votes,
          position.id,
          session.id
        )
      : null
  };
}

export function getActiveSession(sessions: VotingSession[]) {
  return sessions.find((session) => session.status === "berjalan") ?? null;
}

export function sortSessionsByPosition(
  sessions: VotingSession[],
  positions: Position[]
) {
  const order = new Map(positions.map((position) => [position.id, position.order_number]));
  return [...sessions].sort(
    (a, b) => (order.get(a.position_id) ?? 0) - (order.get(b.position_id) ?? 0)
  );
}

export function statusLabel(status: AttendanceStatus | string) {
  const labels: Record<string, string> = {
    belum_hadir: "Belum hadir",
    hadir: "Hadir",
    tidak_hadir: "Tidak hadir",
    belum_dibuka: "Belum dibuka",
    berjalan: "Berjalan",
    ditutup: "Ditutup",
    hasil_diumumkan: "Hasil diumumkan",
    belum_memilih: "Belum memilih",
    sedang_memilih: "Sedang memilih",
    sudah_memilih: "Sudah memilih"
  };
  return labels[status] ?? status;
}
