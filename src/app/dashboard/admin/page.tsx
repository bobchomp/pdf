import { listUsers } from "@/lib/users";
import { TeamManager } from "./team-manager";

export default async function AdminPage() {
  const users = await listUsers();

  return (
    <TeamManager
      users={users.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role }))}
    />
  );
}
