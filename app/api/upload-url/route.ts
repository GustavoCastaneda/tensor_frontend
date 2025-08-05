// app/api/upload-url/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export const runtime = "edge";          // opcional: o "nodejs"

//  POST /api/upload-url   { filename: "sample.xlsx" }
export async function POST(req: NextRequest) {

  const { filename } = await req.json();
  if (!filename) return NextResponse.json({ error: "filename required" }, { status: 400 });

  const { getToken } = await auth();
  const token = await getToken({ template: "Tensor" });

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL}/datasets/upload-url?filename=${encodeURIComponent(
      filename
    )}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );

  const body = await res.json();
  return NextResponse.json(body, { status: res.status });
}
