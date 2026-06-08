import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { ParticipantsClient } from "./ParticipantsClient";

export default async function AdminParticipantsPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");
  return <ParticipantsClient />;
}
