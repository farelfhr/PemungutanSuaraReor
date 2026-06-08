import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import Papa from "papaparse";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import {
  CANDIDATE_NAMES,
  cleanText,
  normalizeGender,
  normalizeName,
  toTitleName
} from "../src/lib/election";
import type { Gender, Participant, Position } from "../src/lib/types";

type RawRow = Record<string, string | undefined>;

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const DEFAULT_LOCAL_CSV =
  "c:\\Users\\user\\Downloads\\Data PRTA.xlsx - 2025.csv";
const DEFAULT_REPO_CSV = path.join(process.cwd(), "data", "participants.csv");

const candidateByNormalizedName = new Map(
  CANDIDATE_NAMES.map((name) => [normalizeName(name), name])
);

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function resolveCsvPath() {
  const explicit = getArgValue("--file") || process.env.PARTICIPANTS_CSV_PATH;
  if (explicit) return explicit;
  if (existsSync(DEFAULT_REPO_CSV)) return DEFAULT_REPO_CSV;
  return DEFAULT_LOCAL_CSV;
}

function isEmailLike(value: string | null) {
  return Boolean(value && /\S+@\S+\.\S+/.test(value));
}

function value(row: RawRow, keys: string[]) {
  for (const key of keys) {
    const match = Object.keys(row).find(
      (header) => cleanText(header).toLocaleLowerCase("id-ID") === key
    );
    if (match) return cleanText(row[match]);
  }
  return "";
}

function normalizeParticipant(row: RawRow, index: number) {
  const rawName = value(row, ["nama lengkap", "nama", "name"]);
  const rawDormitory = value(row, ["asrama", "dormitory"]);
  const rawGender = value(row, [
    "jenis kelamin",
    "gender",
    "jk",
    "kategori"
  ]);
  const gender = normalizeGender(rawGender, rawDormitory);
  const normalized = normalizeName(rawName);
  const canonicalCandidateName = candidateByNormalizedName.get(normalized);
  const generationValue = value(row, ["angkatan", "generation"]);
  const emailValue = value(row, ["email"]);
  const warnings: string[] = [];

  if (!rawName) warnings.push(`Baris ${index + 1}: nama kosong.`);
  if (!gender) warnings.push(`Baris ${index + 1}: gender tidak dapat dibaca.`);
  if (isEmailLike(generationValue) && !emailValue) {
    warnings.push(
      `Baris ${index + 1}: kolom Angkatan berisi email; generation dikosongkan.`
    );
  }

  return {
    warnings,
    participant: {
      name: canonicalCandidateName ?? toTitleName(rawName),
      gender: gender ?? "putri",
      division: value(row, ["jabatan di prta", "jabatan", "division"]) || null,
      dormitory: rawDormitory || null,
      generation:
        generationValue && !isEmailLike(generationValue) ? generationValue : null,
      attendance_status: "belum_hadir",
      is_candidate: Boolean(canonicalCandidateName),
      is_voter: true
    }
  };
}

function shouldSeedCandidateForPosition(
  candidateGender: Gender | null,
  position: Position
) {
  return position.eligible_gender === "all" || position.eligible_gender === candidateGender;
}

async function main() {
  const csvPath = resolveCsvPath();
  if (!existsSync(csvPath)) {
    throw new Error(
      `File CSV tidak ditemukan: ${csvPath}. Gunakan --file atau PARTICIPANTS_CSV_PATH.`
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi sebelum seed."
    );
  }

  const csv = readFileSync(csvPath, "utf8");
  const parsed = Papa.parse<RawRow>(csv, {
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors.length > 0) {
    console.warn("Peringatan parse CSV:");
    for (const error of parsed.errors) {
      console.warn(`- Baris ${error.row}: ${error.message}`);
    }
  }

  const warnings: string[] = [];
  const rows = parsed.data
    .map((row, index) => {
      const normalized = normalizeParticipant(row, index);
      warnings.push(...normalized.warnings);
      return normalized.participant;
    })
    .filter((participant) => participant.name);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const upsertParticipants = await supabase
    .from("participants")
    .upsert(rows, { onConflict: "name" })
    .select("*");

  if (upsertParticipants.error) {
    throw new Error(upsertParticipants.error.message);
  }

  const { data: positions, error: positionsError } = await supabase
    .from("positions")
    .select("*")
    .order("order_number");
  if (positionsError) throw new Error(positionsError.message);

  const { data: participants, error: participantError } = await supabase
    .from("participants")
    .select("*");
  if (participantError) throw new Error(participantError.message);

  const participantMap = new Map(
    (participants as Participant[]).map((participant) => [
      normalizeName(participant.name),
      participant
    ])
  );

  const candidateRows = CANDIDATE_NAMES.flatMap((candidateName) => {
    const participant = participantMap.get(normalizeName(candidateName));
    if (!participant) {
      warnings.push(`Kandidat tidak ditemukan di participants: ${candidateName}`);
    }
    return (positions as Position[])
      .filter((position) =>
        shouldSeedCandidateForPosition(participant?.gender ?? null, position)
      )
      .map((position) => ({
        participant_id: participant?.id ?? null,
        name: candidateName,
        gender: participant?.gender ?? null,
        position_id: position.id
      }));
  });

  const upsertCandidates = await supabase
    .from("candidates")
    .upsert(candidateRows, { onConflict: "position_id,name" });
  if (upsertCandidates.error) throw new Error(upsertCandidates.error.message);

  console.log(`Seed peserta selesai: ${rows.length} peserta diproses.`);
  console.log(`Seed kandidat selesai: ${candidateRows.length} kandidat posisi diproses.`);
  console.log(
    "Asumsi: semua peserta CSV is_voter=true; kandidat tetap pemilih kecuali admin mengubahnya."
  );
  console.log(
    "Asumsi: kandidat Ketua Umum berisi semua kandidat; sesi gender hanya berisi kandidat dengan gender yang sesuai."
  );

  if (warnings.length > 0) {
    console.warn("Peringatan data:");
    for (const warning of warnings) console.warn(`- ${warning}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
