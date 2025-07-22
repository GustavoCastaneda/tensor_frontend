// app/dashboard/page.tsx
import { apiFetch } from "@/lib/api.server"; // helper que usa auth() de Clerk

export default async function Dashboard() {
  const res = await apiFetch("/me");   // GET http://localhost:4000/me
  const me  = await res.json();

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-2">Hola, {me.email ?? "amigo"} 👋</h1>
      <pre className=" p-4 rounded-md">{JSON.stringify(me, null, 2)}</pre>
    </div>
  );
}
