"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Hand, RefreshCcw, Search, Vote } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  PageShell,
  cn
} from "@/components/ui";
import { fetchJson } from "@/lib/client-fetch";
import { statusLabel } from "@/lib/election";
import { useRealtimeRefresh } from "@/lib/realtime";
import type {
  Candidate,
  Gender,
  ParticipantWithVoteStatus,
  Position,
  VotingDeviceState,
  VotingSession
} from "@/lib/types";

const REALTIME_TABLES = [
  "participants",
  "voting_sessions",
  "candidates",
  "voting_devices_state"
];
const EMPTY_PARTICIPANTS: ParticipantWithVoteStatus[] = [];

type VotingData = {
  device: Gender;
  device_state: VotingDeviceState | null;
  allowed: boolean;
  message: string | null;
  active_session: VotingSession | null;
  position: Position | null;
  participants: ParticipantWithVoteStatus[];
  candidates: Candidate[];
};

export function VotingClient({ device }: { device: Gender }) {
  const [data, setData] = useState<VotingData | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeParticipant, setActiveParticipant] =
    useState<ParticipantWithVoteStatus | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [activationLoading, setActivationLoading] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successName, setSuccessName] = useState("");

  const load = useCallback(async () => {
    try {
      const payload = await fetchJson<VotingData>(
        `/api/public/voting?device=${device}`,
        { cache: "no-store" }
      );
      setData(payload);
      setError("");
      const activeFromDevice = payload.device_state?.participant_id
        ? payload.participants.find(
            (participant) =>
              participant.id === payload.device_state?.participant_id &&
              participant.vote_status === "sedang_memilih"
          )
        : null;

      if (
        activeParticipant &&
        !payload.participants.some(
          (participant) =>
            participant.id === activeParticipant.id &&
            (participant.vote_status === "belum_memilih" ||
              participant.vote_status === "sedang_memilih")
        )
      ) {
        setActiveParticipant(null);
        setSelectedCandidate(null);
      } else if (!activeParticipant && activeFromDevice) {
        setActiveParticipant(activeFromDevice);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memuat voting.");
    } finally {
      setLoading(false);
    }
  }, [activeParticipant, device]);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeRefresh(REALTIME_TABLES, load);

  const participants = data?.participants ?? EMPTY_PARTICIPANTS;
  const readyParticipants = participants.filter(
    (participant) => participant.vote_status === "belum_memilih"
  );
  const filteredParticipants = useMemo(() => {
    const search = query.toLocaleLowerCase("id-ID").trim();
    return participants.filter((participant) =>
      search ? participant.name.toLocaleLowerCase("id-ID").includes(search) : true
    );
  }, [participants, query]);

  function canActivate(participant: ParticipantWithVoteStatus) {
    return Boolean(data?.allowed && participant.vote_status === "belum_memilih");
  }

  async function activate(participant: ParticipantWithVoteStatus) {
    if (!data?.active_session) return;
    if (!canActivate(participant)) return;
    setActivationLoading(participant.id);
    setActiveParticipant(participant);
    setSelectedCandidate(null);
    setSuccessName("");
    setError("");

    try {
      await fetchJson("/api/public/device-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device,
          session_id: data.active_session.id,
          participant_id: participant.id
        })
      });
      await load();
    } catch (caught) {
      setActiveParticipant(null);
      setError(caught instanceof Error ? caught.message : "Gagal mengaktifkan peserta.");
    } finally {
      setActivationLoading("");
    }
  }

  async function clearActiveParticipant() {
    const previousParticipant = activeParticipant;
    setActiveParticipant(null);
    setSelectedCandidate(null);
    setError("");

    try {
      await fetchJson("/api/public/device-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device })
      });
      await load();
    } catch (caught) {
      if (previousParticipant) setActiveParticipant(previousParticipant);
      setError(caught instanceof Error ? caught.message : "Gagal membatalkan aktivasi.");
    }
  }

  async function submitVote() {
    if (!data?.active_session || !activeParticipant || !selectedCandidate) return;
    setSubmitting(true);
    try {
      await fetchJson("/api/public/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: data.active_session.id,
          participant_id: activeParticipant.id,
          candidate_id: selectedCandidate.id,
          device
        })
      });
      setSuccessName(activeParticipant.name);
      setActiveParticipant(null);
      setSelectedCandidate(null);
      await load();
      window.setTimeout(() => setSuccessName(""), 2600);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menyimpan suara.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell>
      <header className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Beranda
          </Link>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-950">
            <Vote className="h-7 w-7 text-primary-700" aria-hidden="true" />
            Laptop Voting {statusLabel(device)}
          </h1>
        </div>
        <Button variant="secondary" onClick={load}>
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </header>

      {error ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <EmptyState title="Memuat sesi voting..." />
      ) : !data?.active_session ? (
        <EmptyState title="Belum ada sesi voting yang dibuka." />
      ) : !data.allowed ? (
        <EmptyState title={data.message ?? "Sesi ini tidak tersedia untuk device ini."} />
      ) : (
        <div className="grid min-h-[70vh] gap-5 lg:grid-cols-[420px_1fr]">
          <section className="space-y-4">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-primary-700">Sesi</p>
                  <h2 className="text-xl font-bold text-slate-950">
                    {data.position?.name}
                  </h2>
                </div>
                <Badge value={data.active_session.status} tone="green" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="font-semibold text-slate-500">Siap memilih</div>
                  <div className="mt-1 text-2xl font-bold text-primary-700">
                    {readyParticipants.length}
                  </div>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <div className="font-semibold text-slate-500">Kandidat</div>
                  <div className="mt-1 text-2xl font-bold text-primary-700">
                    {data.candidates.length}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="space-y-3">
              <label className="relative block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  className="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3 outline-none focus:border-primary-700 focus:ring-2 focus:ring-blue-100"
                  placeholder="Cari nama peserta"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <div className="max-h-[55vh] space-y-2 overflow-auto pr-1">
                {filteredParticipants.map((participant) => (
                  <button
                    key={participant.id}
                    draggable={canActivate(participant)}
                    onDragStart={(event) =>
                      event.dataTransfer.setData("participant_id", participant.id)
                    }
                    onClick={() => void activate(participant)}
                    disabled={!canActivate(participant) || Boolean(activationLoading)}
                    className={cn(
                      "w-full rounded-md border p-3 text-left transition",
                      canActivate(participant)
                        ? "border-slate-200 bg-white hover:border-primary-700 hover:bg-blue-50"
                        : "border-slate-100 bg-slate-50 opacity-70",
                      activeParticipant?.id === participant.id
                        ? "border-primary-700 bg-blue-50 opacity-100"
                        : ""
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">
                          {participant.name}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {participant.dormitory ?? "-"} - {participant.division ?? "-"}
                        </div>
                      </div>
                      <Badge value={participant.vote_status} />
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </section>

          <section
            className="min-h-[480px] rounded-lg border-2 border-dashed border-blue-200 bg-white p-5"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const id = event.dataTransfer.getData("participant_id");
              const participant = participants.find((item) => item.id === id);
              if (participant) void activate(participant);
            }}
          >
            {successName ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <CheckCircle2 className="h-20 w-20 text-success" aria-hidden="true" />
                <h2 className="mt-5 text-4xl font-bold text-slate-950">
                  Suara berhasil direkam.
                </h2>
                <p className="mt-3 text-xl text-slate-600">Terima kasih, {successName}.</p>
              </div>
            ) : activeParticipant ? (
              <div className="space-y-5">
                <div className="rounded-md bg-blue-50 p-4 ring-1 ring-blue-100">
                  <div className="text-sm font-bold text-primary-700">
                    Peserta aktif
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-950">
                    {activeParticipant.name}
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-950">
                  Silakan pilih kandidat untuk {data.position?.name}
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {data.candidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      onClick={() => setSelectedCandidate(candidate)}
                      className="min-h-24 rounded-lg border-2 border-slate-200 bg-white p-4 text-left text-xl font-bold text-slate-950 transition hover:border-primary-700 hover:bg-blue-50"
                    >
                      {candidate.name}
                    </button>
                  ))}
                </div>
                <Button variant="secondary" onClick={() => void clearActiveParticipant()}>
                  Batalkan Aktivasi
                </Button>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Hand className="h-20 w-20 text-primary-700" aria-hidden="true" />
                <h2 className="mt-5 text-3xl font-bold text-slate-950">
                  Aktifkan peserta
                </h2>
                <p className="mt-3 max-w-lg text-lg text-slate-600">
                  Klik atau drag nama peserta dari daftar kiri ke area ini.
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {selectedCandidate && activeParticipant ? (
        <Modal
          title="Konfirmasi pilihan"
          description={`Apakah Anda yakin memilih ${selectedCandidate.name}?`}
          onClose={() => setSelectedCandidate(null)}
        >
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSelectedCandidate(null)}>
              Batal
            </Button>
            <Button disabled={submitting} onClick={submitVote}>
              Ya, Kirim Suara
            </Button>
          </div>
        </Modal>
      ) : null}
    </PageShell>
  );
}
