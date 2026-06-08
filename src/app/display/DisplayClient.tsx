"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Presentation, RefreshCcw } from "lucide-react";
import { Button, EmptyState, ProgressBar, Stat } from "@/components/ui";
import { fetchJson } from "@/lib/client-fetch";
import { statusLabel } from "@/lib/election";
import { useRealtimeRefresh } from "@/lib/realtime";
import type { SessionSummary } from "@/lib/types";

const REALTIME_TABLES = ["participants", "voting_sessions", "candidates"];

type DisplayOverview = {
  summary: SessionSummary | null;
  generated_at: string;
};

export function DisplayClient() {
  const [overview, setOverview] = useState<DisplayOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchJson<DisplayOverview>("/api/public/overview", {
        cache: "no-store"
      });
      setOverview(data);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal memuat display.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeRefresh(REALTIME_TABLES, load);

  const summary = overview?.summary ?? null;

  return (
    <main className="min-h-screen bg-white px-6 py-6 text-slate-950">
      <header className="mx-auto mb-8 flex max-w-7xl items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Beranda
        </Link>
        <Button variant="secondary" onClick={load}>
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </header>

      <section className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-50 text-primary-700">
            <Presentation className="h-9 w-9" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xl font-bold text-primary-700">LPJ dan Reorganisasi</p>
            <h1 className="text-5xl font-bold text-slate-950">
              PRTA Universitas Negeri Malang 2026
            </h1>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-lg font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <EmptyState title="Memuat display..." />
        ) : !summary ? (
          <EmptyState title="Belum ada sesi voting." />
        ) : (
          <div className="space-y-8">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-2xl font-bold text-primary-700">
                    {statusLabel(summary.session.status)}
                  </p>
                  <h2 className="mt-2 text-6xl font-bold leading-tight text-slate-950">
                    {summary.position.name}
                  </h2>
                </div>
                <div className="rounded-lg bg-white px-6 py-4 text-right shadow-soft">
                  <div className="text-lg font-semibold text-slate-500">Progress</div>
                  <div className="text-6xl font-bold text-primary-700">
                    {summary.progress_percent}%
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <ProgressBar value={summary.progress_percent} />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
                <Stat label="Hadir dan Berhak" value={summary.active_voters} />
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
                <Stat
                  label="Sudah Memilih"
                  value={summary.votes_submitted}
                  tone="green"
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
                <Stat
                  label="Belum Memilih"
                  value={summary.remaining_voters}
                  tone="amber"
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-soft">
                <Stat label="Tidak Hadir" value={summary.not_present} tone="red" />
              </div>
            </div>

            {summary.results ? (
              <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-soft">
                <h2 className="mb-5 text-4xl font-bold text-slate-950">
                  Hasil Akhir
                </h2>
                <div className="grid gap-3">
                  {summary.results.map((result) => (
                    <div
                      key={result.candidate_id}
                      className="flex items-center justify-between rounded-md bg-slate-50 px-5 py-4"
                    >
                      <div className="text-3xl font-bold text-slate-900">
                        {result.name}
                      </div>
                      <div className="text-4xl font-bold text-primary-700">
                        {result.votes} suara
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
