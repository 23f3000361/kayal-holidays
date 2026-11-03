import type { Metadata } from "next";
import { requireUser } from "@/server/auth";
import { listStaff } from "@/server/users";
import { PageBody, PageHeader } from "@/components/admin/bits";
import { StaffManager } from "./staff-manager";

export const metadata: Metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireUser("users.manage", "/admin/users");
  const { staff, travellers } = await listStaff();
  return (
    <>
      <PageHeader title="Team" subtitle={`Who can sign in to the admin, and what they can do. ${travellers} traveller account${travellers === 1 ? "" : "s"} manage themselves.`} />
      <PageBody className="max-w-5xl">
        <StaffManager meId={me.id} staff={staff.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))} />
      </PageBody>
    </>
  );
}
