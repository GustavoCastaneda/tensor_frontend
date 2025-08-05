// app/dashboard/page.tsx
import { apiServerFetch } from '@/lib/api.server';
import UploadDataset from '@/src/components/UploadDataset';

export default async function Dashboard() {
  const me = await apiServerFetch('/me').then(r => r.json());
  
  return (
    <div className="container mx-auto p-6 space-y-6 ">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      
     
    </div>
  );
}
