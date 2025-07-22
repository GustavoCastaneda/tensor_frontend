// app/dashboard/page.tsx
import { apiServerFetch } from '@/lib/api.server';

export default async function Dashboard() {
  const me = await apiServerFetch('/me').then(r => r.json());
  return <pre>{JSON.stringify(me, null, 2)}</pre>;
}
