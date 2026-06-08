"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  LogOut,
  Play,
  RefreshCcw,
  Square,
  UsersRound
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  Modal,
  PageShell,
  ProgressBar,
  Stat
} from "@/components/ui";
import { fetchJson } from "@/lib/client-fetch";
import { statusLabel } from "@/lib/election";
import { useRealtimeRefresh } from "@/lib/realtime";
import type { SessionSummary } from "@/lib/types";

const REALTIME_TABLES = ["participants", "voting_sessions", "candidates"];

type AdminOverview = {
  active_session: SessionSummary | null;
  sessions: SessionSummary[];
  totals: {
    participants: number;
    present: number;
    absent: number;
    not_checked_in: number;
    candidates: number;
  };
  generated_at: string;
};

export function AdminDashboardClient() {
  const router = useRouter();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [closeTarget, setCloseTarget] = useState<SessionSummary | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<AdminOverview>("/api/admin/overview", {
        cache: "no-store"
      });
      setOverview(data);
      setError("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Gagal memuat data.";
      setError(message);
      if (message === "Unauthorized") router.push("/admin/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeRefresh(REALTIME_TABLES, load);

  async function runAction(label: string, url: string) {
    setActionLoading(label);
    try {
      await fetchJson(url, { method: "POST" });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aksi gagal.");
    } finally {
      setActionLoading("");
      setCloseTarget(null);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const recapCsv = useMemo(() => {
    if (!overview) return "";
    const lines = [
      ["Sesi", "Kandidat", "Suara"].join(","),
      ...overview.sessions.flatMap((summary) =>
        (summary.results ?? []).map((result) =>
          [summary.position.name, result.name, result.votes]
            .map((item) => `"${String(item).replaceAll('"', '""')}"`)
            .join(",")
        )
      )
    ];
    return lines.join("\n");
  }, [overview]);

  function downloadCsv() {
    const blob = new Blob([recapCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "rekap-voting-prta-2026.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function copyRecap() {
    if (!overview) return;
    const text = overview.sessions
      .filter((summary) => summary.results)
      .map((summary) => {
        const results = summary.results
          ?.map((result) => `${result.name}: ${result.votes} suara`)
          .join("\n");
        return `${summary.position.name}\n${results}`;
      })
      .join("\n\n");
    void navigator.clipboard.writeText(text);
  }

  return (
    <PageShell>
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-primary-700">
            Admin
          </p>
          <h1 className="text-3xl font-bold text-slate-950">Dashboard Voting</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/admin/participants" variant="secondary">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
            Peserta
          </LinkButton>
          <LinkButton href="/admin/candidates" variant="secondary">
            <Eye className="h-4 w-4" aria-hidden="true" />
            Kandidat
          </LinkButton>
          <Button variant="ghost" onClick={load} title="Refresh">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
          <Button variant="ghost" onClick={logout} title="Logout">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </Button>
        </div>
      </header>

      {error ? (
        <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <EmptyState title="Memuat dashboard..." />
      ) : overview ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-4">
            <Card>
              <Stat label="Total Peserta" value={overview.totals.participants} />
            </Card>
            <Card>
              <Stat label="Hadir" value={overview.totals.present} tone="green" />
            </Card>
            <Card>
              <Stat label="Tidak Hadir" value={overview.totals.absent} tone="red" />
            </Card>
            <Card>
              <Stat
                label="Belum Presensi"
                value={overview.totals.not_checked_in}
                tone="amber"
              />
            </Card>
          </section>

          {overview.active_session ? (
            <ActiveSessionCard summary={overview.active_session} />
          ) : (
            <EmptyState
              title="Tidak ada sesi berjalan"
              body="Buka sesi berikutnya dari daftar sesi di bawah."
            />
          )}

          <section className="grid gap-4 lg:grid-cols-2">
            {overview.sessions.map((summary) => (
              <Card key={summary.session.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950">
                      {summary.position.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Hak suara:{" "}
                      {summary.position.eligible_gender === "all"
                        ? "semua peserta"
                        : `peserta ${summary.position.eligible_gender}`}
                    </p>
                  </div>
                  <Badge value={summary.session.status} />
                </div>

                <ProgressBar value={summary.progress_percent} />
                <div className="grid grid-cols-4 gap-3 text-sm">
                  <MiniStat label="Hadir" value={summary.active_voters} />
                  <MiniStat label="Suara" value={summary.votes_submitted} />
                  <MiniStat label="Sisa" value={summary.remaining_voters} />
                  <MiniStat label="Progress" value={`${summary.progress_percent}%`} />
                </div>

                <div className="flex flex-wrap gap-2">
                  {summary.session.status === "belum_dibuka" ? (
                    <Button
                      disabled={Boolean(actionLoading)}
                      onClick={() =>
                        runAction(
                          `open-${summary.session.id}`,
                          `/api/admin/sessions/${summary.session.id}/open`
                        )
                      }
                    >
                      <Play className="h-4 w-4" aria-hidden="true" />
                      Buka Sesi
                    </Button>
                  ) : null}
                  {summary.session.status === "berjalan" ? (
                    <Button
                      variant="danger"
                      disabled={Boolean(actionLoading)}
                      onClick={() =>
                        summary.remaining_voters > 0
                          ? setCloseTarget(summary)
                          : runAction(
                              `close-${summary.session.id}`,
                              `/api/admin/sessions/${summary.session.id}/close`
                            )
                      }
                    >
                      <Square className="h-4 w-4" aria-hidden="true" />
                      End Sesi
                    </Button>
                  ) : null}
                  {summary.session.status === "ditutup" ? (
                    <Button
                      variant="success"
                      disabled={Boolean(actionLoading)}
                      onClick={() =>
                        runAction(
                          `announce-${summary.session.id}`,
                          `/api/admin/sessions/${summary.session.id}/announce`
                        )
                      }
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      Umumkan Hasil
                    </Button>
                  ) : null}
                </div>

                {summary.results ? <ResultsList summary={summary} /> : null}
              </Card>
            ))}
          </section>

          <section className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={downloadCsv}
              disabled={!recapCsv.includes("\n")}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
            <Button
              variant="secondary"
              onClick={copyRecap}
              disabled={!recapCsv.includes("\n")}
            >
              Salin Rekap
            </Button>
            <Link
              className="inline-flex h-11 items-center rounded-md px-3 text-sm font-semibold text-primary-700 hover:bg-blue-50"
              href="/display"
              target="_blank"
            >
              Buka Display
            </Link>
          </section>
        </div>
      ) : null}

      {closeTarget ? (
        <Modal
          title="Akhiri sesi?"
          description={`Masih ada ${closeTarget.remaining_voters} peserta hadir yang belum memilih. Apakah Anda tetap ingin mengakhiri sesi ini?`}
          onClose={() => setCloseTarget(null)}
        >
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCloseTarget(null)}>
              Batalkan
            </Button>
            <Button
              variant="danger"
              disabled={Boolean(actionLoading)}
              onClick={() =>
                runAction(
                  `close-${closeTarget.session.id}`,
                  `/api/admin/sessions/${closeTarget.session.id}/close`
                )
              }
            >
              Ya, Akhiri Sesi
            </Button>
          </div>
        </Modal>
      ) : null}
    </PageShell>
  );
}

function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

function ActiveSessionCard({ summary }: { summary: SessionSummary }) {
  return (
    <Card className="space-y-5 border-primary-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-primary-700">
            Sesi Aktif
          </p>
          <h2 className="text-2xl font-bold text-slate-950">
            {summary.position.name}
          </h2>
        </div>
        <Badge value={summary.session.status} tone="green" />
      </div>
      <ProgressBar value={summary.progress_percent} />
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Hadir dan Berhak" value={summary.active_voters} />
        <Stat label="Sudah Memilih" value={summary.votes_submitted} tone="green" />
        <Stat label="Belum Memilih" value={summary.remaining_voters} tone="amber" />
        <Stat label="Progress" value={`${summary.progress_percent}%`} tone="blue" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ParticipantList
          title="Sudah memilih"
          participants={summary.voted_participants}
        />
        <ParticipantList
          title="Hadir belum memilih"
          participants={summary.remaining_participants}
        />
      </div>
    </Card>
  );
}

function ParticipantList({
  title,
  participants
}: {
  title: string;
  participants: { id: string; name: string }[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-bold text-slate-700">{title}</h3>
      <div className="max-h-52 overflow-auto rounded-md border border-slate-200">
        {participants.length === 0 ? (
          <div className="p-3 text-sm text-slate-500">Tidak ada data.</div>
        ) : (
          participants.map((participant) => (
            <div
              key={participant.id}
              className="border-b border-slate-100 px-3 py-2 text-sm last:border-0"
            >
              {participant.name}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ResultsList({ summary }: { summary: SessionSummary }) {
  return (
    <div className="rounded-md border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
        Hasil Akhir - {statusLabel(summary.session.status)}
      </div>
      {(summary.results ?? []).map((result) => (
        <div
          key={result.candidate_id}
          className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-0"
        >
          <span className="font-semibold text-slate-800">{result.name}</span>
          <span className="text-lg font-bold text-primary-700">
            {result.votes} suara
          </span>
        </div>
      ))}
    </div>
  );
}
