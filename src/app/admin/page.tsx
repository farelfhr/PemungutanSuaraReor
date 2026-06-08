import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import { AdminDashboardClient } from "./AdminDashboardClient";

export default async function AdminPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login");
  return <AdminDashboardClient />;
}
