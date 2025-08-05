// app/knowledge/page.tsx
import { apiServerFetch } from '@/lib/api.server';  
import UploadDataset from '@/src/components/UploadDataset';

export default async function Knowledge() {
  
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-4">Knowledge Base</h1>
      
      {/* Upload Dataset Section */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">Upload Dataset</h2>
        <UploadDataset />
      </div>
    </div>
  );
}
