import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { CandidatesClient } from "./CandidatesClient";

export default async function AdminCandidatesPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");
  return <CandidatesClient />;
}
