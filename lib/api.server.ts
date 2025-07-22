// lib/api.server.ts  (tu mismo código, sin cambios)
import { auth } from "@clerk/nextjs/server";

export async function apiFetch(
  endpoint: string,
  init: RequestInit = {},
) {
  const { getToken } = await auth();
  const token = await getToken();

  return fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL}${endpoint}`,
    { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } },
  );
}
