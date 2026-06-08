export type Gender = "putra" | "putri";
export type EligibleGender = Gender | "all";
export type AttendanceStatus = "belum_hadir" | "hadir" | "tidak_hadir";
export type SessionStatus =
  | "belum_dibuka"
  | "berjalan"
  | "ditutup"
  | "hasil_diumumkan";

export type Participant = {
  id: string;
  name: string;
  gender: Gender;
  division: string | null;
  dormitory: string | null;
  generation: string | null;
  attendance_status: AttendanceStatus;
  is_candidate: boolean;
  is_voter: boolean;
  created_at: string;
};

export type Position = {
  id: string;
  name: string;
  eligible_gender: EligibleGender;
  order_number: number;
  created_at: string;
};

export type Candidate = {
  id: string;
  participant_id: string | null;
  name: string;
  gender: Gender | null;
  position_id: string;
  created_at: string;
};

export type VotingSession = {
  id: string;
  position_id: string;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Vote = {
  id: string;
  session_id: string;
  participant_id: string;
  candidate_id: string;
  created_at: string;
};

export type DeviceStatus = "idle" | "voting";

export type VotingDeviceState = {
  id: string;
  device_type: Gender;
  session_id: string | null;
  participant_id: string | null;
  status: DeviceStatus;
  updated_at: string;
};

export type CandidateResult = {
  candidate_id: string;
  name: string;
  gender: Gender | null;
  votes: number;
};

export type ParticipantVoteStatus =
  | "belum_memilih"
  | "sedang_memilih"
  | "sudah_memilih"
  | "belum_hadir"
  | "tidak_hadir";

export type ParticipantWithVoteStatus = Participant & {
  vote_status: ParticipantVoteStatus;
};

export type SessionSummary = {
  session: VotingSession;
  position: Position;
  eligible_voters: number;
  active_voters: number;
  votes_submitted: number;
  remaining_voters: number;
  not_present: number;
  not_checked_in: number;
  progress_percent: number;
  voted_participants: Participant[];
  remaining_participants: Participant[];
  results: CandidateResult[] | null;
};

export type ElectionSnapshot = {
  participants: Participant[];
  positions: Position[];
  candidates: Candidate[];
  sessions: VotingSession[];
  votes: Vote[];
};
