// src/lib/useUploadUrl.ts
export async function getUploadUrl(filename: string) {
    const res = await fetch("/api/upload-url", {
      method: "POST",
      body: JSON.stringify({ filename }),
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Failed presign");
    return res.json() as Promise<{
      dataset_id: string;
      upload_url: string;
      object_key: string;
    }>;
  }
  