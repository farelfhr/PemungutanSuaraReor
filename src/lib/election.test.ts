import { describe, expect, it } from "vitest";
import {
  applyDeviceVotingStates,
  buildParticipantVoteStatuses,
  computeSessionSummary,
  isEligibleForPosition,
  normalizeGender
} from "./election";
import type { ElectionSnapshot } from "./types";

describe("election helpers", () => {
  it("normalizes Indonesian gender values and dormitory fallback", () => {
    expect(normalizeGender("Laki-laki")).toBe("putra");
    expect(normalizeGender("Perempuan ")).toBe("putri");
    expect(normalizeGender("", "Lili")).toBe("putra");
    expect(normalizeGender("", "Tulip")).toBe("putri");
  });

  it("checks position eligibility by gender and voter flag", () => {
    expect(isEligibleForPosition({ gender: "putra", is_voter: true }, "all")).toBe(
      true
    );
    expect(
      isEligibleForPosition({ gender: "putra", is_voter: true }, "putri")
    ).toBe(false);
    expect(
      isEligibleForPosition({ gender: "putri", is_voter: false }, "putri")
    ).toBe(false);
  });

  it("computes progress and candidate results without counting absent voters as active", () => {
    const snapshot: ElectionSnapshot = {
      positions: [
        {
          id: "pos-1",
          name: "Ketua Umum",
          eligible_gender: "all",
          order_number: 1,
          created_at: "now"
        }
      ],
      sessions: [
        {
          id: "session-1",
          position_id: "pos-1",
          status: "ditutup",
          started_at: "now",
          ended_at: "now",
          created_at: "now",
          updated_at: "now"
        }
      ],
      participants: [
        {
          id: "p-1",
          name: "A",
          gender: "putra",
          division: null,
          dormitory: null,
          generation: null,
          attendance_status: "hadir",
          is_candidate: false,
          is_voter: true,
          created_at: "now"
        },
        {
          id: "p-2",
          name: "B",
          gender: "putri",
          division: null,
          dormitory: null,
          generation: null,
          attendance_status: "tidak_hadir",
          is_candidate: false,
          is_voter: true,
          created_at: "now"
        }
      ],
      candidates: [
        {
          id: "c-1",
          participant_id: null,
          name: "Kandidat A",
          gender: "putra",
          position_id: "pos-1",
          created_at: "now"
        }
      ],
      votes: [
        {
          id: "v-1",
          session_id: "session-1",
          participant_id: "p-1",
          candidate_id: "c-1",
          created_at: "now"
        }
      ]
    };

    const summary = computeSessionSummary(snapshot, snapshot.sessions[0], {
      includeResults: true
    });

    expect(summary.eligible_voters).toBe(2);
    expect(summary.active_voters).toBe(1);
    expect(summary.not_present).toBe(1);
    expect(summary.votes_submitted).toBe(1);
    expect(summary.progress_percent).toBe(100);
    expect(summary.results?.[0]).toMatchObject({
      name: "Kandidat A",
      votes: 1
    });
  });

  it("marks an active device participant as currently voting", () => {
    const snapshot: ElectionSnapshot = {
      positions: [
        {
          id: "pos-1",
          name: "Ketua Umum",
          eligible_gender: "all",
          order_number: 1,
          created_at: "now"
        }
      ],
      sessions: [
        {
          id: "session-1",
          position_id: "pos-1",
          status: "berjalan",
          started_at: "now",
          ended_at: null,
          created_at: "now",
          updated_at: "now"
        }
      ],
      participants: [
        {
          id: "p-1",
          name: "A",
          gender: "putra",
          division: null,
          dormitory: null,
          generation: null,
          attendance_status: "hadir",
          is_candidate: false,
          is_voter: true,
          created_at: "now"
        }
      ],
      candidates: [],
      votes: []
    };

    const participants = buildParticipantVoteStatuses(
      snapshot.participants,
      snapshot.sessions[0],
      snapshot.votes
    );
    const withDeviceState = applyDeviceVotingStates(
      participants,
      [
        {
          id: "device-1",
          device_type: "putra",
          session_id: "session-1",
          participant_id: "p-1",
          status: "voting",
          updated_at: "now"
        }
      ],
      snapshot.sessions[0]
    );

    expect(withDeviceState[0].vote_status).toBe("sedang_memilih");
  });
});
