import { notFound } from "next/navigation";
import { VotingClient } from "./VotingClient";
import type { Gender } from "@/lib/types";

export default async function VotePage({
  params
}: {
  params: Promise<{ gender: string }>;
}) {
  const { gender } = await params;
  if (gender !== "putra" && gender !== "putri") notFound();
  return <VotingClient device={gender as Gender} />;
}
