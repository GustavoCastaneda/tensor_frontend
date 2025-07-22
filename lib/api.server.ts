// lib/api.server.ts  (versión corregida)
import { auth } from '@clerk/nextjs/server';

export async function apiServerFetch(
  endpoint: string,
  init: RequestInit = {},
) {
  // 👇  espera la promesa
  const { getToken } = await auth();

  // getToken() también es async
  const token = await getToken({ template: 'Tensor' });

  return fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}${endpoint}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
