import {
  Monitor,
  Presentation,
  ShieldCheck,
  UsersRound,
  Vote
} from "lucide-react";
import { LinkButton, PageShell } from "@/components/ui";

export default function HomePage() {
  return (
    <PageShell className="flex items-center">
      <section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-primary-700 ring-1 ring-blue-100">
            <Vote className="h-4 w-4" aria-hidden="true" />
            PRTA UM 2026
          </div>
          <h1 className="mt-6 text-4xl font-bold leading-tight text-slate-950 sm:text-5xl">
            Pemungutan Suara Digital Reorganisasi PRTA
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Sistem voting berbasis laptop panitia untuk sesi Ketua Umum, Wakil
            Ketua Putra 1, Wakil Ketua Putri 1, dan Wakil Ketua Putri 2.
          </p>
        </div>

        <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <LinkButton href="/admin/login" size="lg" className="justify-start">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            Masuk Admin
          </LinkButton>
          <LinkButton
            href="/vote/putra"
            size="lg"
            variant="secondary"
            className="justify-start"
          >
            <Monitor className="h-5 w-5" aria-hidden="true" />
            Laptop Voting Putra
          </LinkButton>
          <LinkButton
            href="/vote/putri"
            size="lg"
            variant="secondary"
            className="justify-start"
          >
            <UsersRound className="h-5 w-5" aria-hidden="true" />
            Laptop Voting Putri
          </LinkButton>
          <LinkButton
            href="/display"
            size="lg"
            variant="secondary"
            className="justify-start"
          >
            <Presentation className="h-5 w-5" aria-hidden="true" />
            Display Proyektor
          </LinkButton>
        </div>
      </section>
    </PageShell>
  );
}
