"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCcw, Search, UsersRound } from "lucide-react";
import { Badge, Button, Card, EmptyState, PageShell } from "@/components/ui";
import { fetchJson } from "@/lib/client-fetch";
import { statusLabel } from "@/lib/election";
import { useRealtimeRefresh } from "@/lib/realtime";
import type { AttendanceStatus, Gender, Participant } from "@/lib/types";

const REALTIME_TABLES = ["participants", "voting_sessions"];
const GENDERS: Array<Gender | "all"> = ["all", "putra", "putri"];
const ATTENDANCE: AttendanceStatus[] = ["belum_hadir", "hadir", "tidak_hadir"];

export function ParticipantsClient() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<Gender | "all">("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<{ participants: Participant[] }>(
        "/api/admin/participants",
        { cache: "no-store" }
      );
      setParticipants(data.participants);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memuat peserta.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeRefresh(REALTIME_TABLES, load);

  const filtered = useMemo(() => {
    const search = query.toLocaleLowerCase("id-ID").trim();
    return participants.filter((participant) => {
      const genderOk = gender === "all" || participant.gender === gender;
      const searchOk =
        !search ||
        participant.name.toLocaleLowerCase("id-ID").includes(search) ||
        (participant.division ?? "").toLocaleLowerCase("id-ID").includes(search) ||
        (participant.dormitory ?? "").toLocaleLowerCase("id-ID").includes(search);
      return genderOk && searchOk;
    });
  }, [gender, participants, query]);

  async function updateParticipant(
    id: string,
    patch: Partial<
      Pick<Participant, "attendance_status" | "is_candidate" | "is_voter">
    >
  ) {
    setUpdating(id);
    try {
      await fetchJson("/api/admin/participants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, patch })
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal mengubah peserta.");
    } finally {
      setUpdating("");
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
            <UsersRound className="h-7 w-7 text-primary-700" aria-hidden="true" />
            Manajemen Peserta
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

      <Card className="mb-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              className="h-11 w-full rounded-md border border-slate-300 pl-10 pr-3 outline-none focus:border-primary-700 focus:ring-2 focus:ring-blue-100"
              placeholder="Cari nama, bidang, atau asrama"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="flex gap-2">
            {GENDERS.map((item) => (
              <Button
                key={item}
                type="button"
                variant={gender === item ? "primary" : "secondary"}
                onClick={() => setGender(item)}
              >
                {item === "all" ? "Semua" : statusLabel(item)}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <EmptyState title="Memuat peserta..." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-bold">Nama</th>
                  <th className="px-4 py-3 font-bold">Gender</th>
                  <th className="px-4 py-3 font-bold">Asrama</th>
                  <th className="px-4 py-3 font-bold">Bidang</th>
                  <th className="px-4 py-3 font-bold">Kehadiran</th>
                  <th className="px-4 py-3 font-bold">Hak</th>
                  <th className="px-4 py-3 font-bold">Kandidat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((participant) => (
                  <tr key={participant.id} className="align-top">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {participant.name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge value={participant.gender} tone="blue" />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {participant.dormitory ?? "-"}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-600">
                      {participant.division ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {ATTENDANCE.map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={
                              participant.attendance_status === status
                                ? "primary"
                                : "secondary"
                            }
                            disabled={updating === participant.id}
                            onClick={() =>
                              updateParticipant(participant.id, {
                                attendance_status: status
                              })
                            }
                          >
                            {statusLabel(status)}
                          </Button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant={participant.is_voter ? "success" : "secondary"}
                        disabled={updating === participant.id}
                        onClick={() =>
                          updateParticipant(participant.id, {
                            is_voter: !participant.is_voter
                          })
                        }
                      >
                        {participant.is_voter ? "Pemilih" : "Non-pemilih"}
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant={participant.is_candidate ? "primary" : "secondary"}
                        disabled={updating === participant.id}
                        onClick={() =>
                          updateParticipant(participant.id, {
                            is_candidate: !participant.is_candidate
                          })
                        }
                      >
                        {participant.is_candidate ? "Kandidat" : "Bukan"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Tidak ada peserta sesuai filter.
            </div>
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
