"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, RefreshCcw, Trash2, UserRoundCheck } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageShell } from "@/components/ui";
import { fetchJson } from "@/lib/client-fetch";
import { useRealtimeRefresh } from "@/lib/realtime";
import type { Candidate, Gender, Participant, Position } from "@/lib/types";

const REALTIME_TABLES = ["participants", "positions", "candidates"];

type CandidateContext = {
  positions: Position[];
  candidates: Candidate[];
  participants: Participant[];
};

export function CandidatesClient() {
  const [context, setContext] = useState<CandidateContext | null>(null);
  const [positionId, setPositionId] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualGender, setManualGender] = useState<Gender | "">("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<CandidateContext>("/api/admin/candidates", {
        cache: "no-store"
      });
      setContext(data);
      setPositionId((current) => current || data.positions[0]?.id || "");
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memuat kandidat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeRefresh(REALTIME_TABLES, load);

  const grouped = useMemo(() => {
    if (!context) return [];
    return context.positions.map((position) => ({
      position,
      candidates: context.candidates.filter(
        (candidate) => candidate.position_id === position.id
      )
    }));
  }, [context]);

  async function addCandidate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!positionId) return;
    setSaving(true);
    try {
      await fetchJson("/api/admin/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position_id: positionId,
          participant_id: participantId || null,
          name: participantId ? undefined : manualName,
          gender: participantId ? undefined : manualGender || null
        })
      });
      setParticipantId("");
      setManualName("");
      setManualGender("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menambah kandidat.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCandidate(id: string) {
    setSaving(true);
    try {
      await fetchJson("/api/admin/candidates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal menghapus kandidat.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Link
            href="/admin"
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Dashboard
          </Link>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-950">
            <UserRoundCheck className="h-7 w-7 text-primary-700" aria-hidden="true" />
            Manajemen Kandidat
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

      {loading || !context ? (
        <EmptyState title="Memuat kandidat..." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <Card>
            <h2 className="text-xl font-bold text-slate-950">Tambah Kandidat</h2>
            <form className="mt-4 space-y-4" onSubmit={addCandidate}>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Posisi</span>
                <select
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3"
                  value={positionId}
                  onChange={(event) => setPositionId(event.target.value)}
                  required
                >
                  {context.positions.map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Ambil dari Peserta
                </span>
                <select
                  className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3"
                  value={participantId}
                  onChange={(event) => setParticipantId(event.target.value)}
                >
                  <option value="">Input manual</option>
                  {context.participants
                    .filter((participant) => participant.is_candidate)
                    .map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.name}
                      </option>
                    ))}
                </select>
              </label>

              {!participantId ? (
                <>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">
                      Nama Manual
                    </span>
                    <input
                      className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3"
                      value={manualName}
                      onChange={(event) => setManualName(event.target.value)}
                      required={!participantId}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">
                      Gender Kandidat
                    </span>
                    <select
                      className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3"
                      value={manualGender}
                      onChange={(event) =>
                        setManualGender(event.target.value as Gender | "")
                      }
                    >
                      <option value="">Tidak diisi</option>
                      <option value="putra">Putra</option>
                      <option value="putri">Putri</option>
                    </select>
                  </label>
                </>
              ) : null}

              <Button type="submit" disabled={saving} className="w-full">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Tambah
              </Button>
            </form>
          </Card>

          <div className="grid gap-4">
            {grouped.map(({ position, candidates }) => (
              <Card key={position.id}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">
                      {position.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Hak suara:{" "}
                      {position.eligible_gender === "all"
                        ? "semua peserta"
                        : `peserta ${position.eligible_gender}`}
                    </p>
                  </div>
                  <Badge value={position.eligible_gender} tone="blue" />
                </div>

                {candidates.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Belum ada kandidat pada posisi ini.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
                    {candidates.map((candidate) => (
                      <div
                        key={candidate.id}
                        className="flex items-center justify-between gap-3 px-3 py-3"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {candidate.name}
                          </div>
                          <div className="mt-1 flex gap-2">
                            {candidate.gender ? (
                              <Badge value={candidate.gender} tone="blue" />
                            ) : null}
                            {candidate.participant_id ? (
                              <Badge value="Dari peserta" tone="green" />
                            ) : (
                              <Badge value="Manual" tone="gray" />
                            )}
                          </div>
                        </div>
                        <Button
                          aria-label={`Hapus ${candidate.name}`}
                          title="Hapus kandidat"
                          variant="ghost"
                          disabled={saving}
                          onClick={() => removeCandidate(candidate.id)}
                        >
                          <Trash2 className="h-5 w-5 text-danger" aria-hidden="true" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </PageShell>
  );
}
