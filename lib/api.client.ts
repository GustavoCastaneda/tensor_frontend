// lib/api.client.ts  – para componentes cliente
import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

export function useApiFetch() {
  const { getToken } = useAuth();
  return useCallback(
    async (endpoint: string, init: RequestInit = {}) => {
      const token = await getToken({ template: "Tensor" });
      return fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}${endpoint}`,
        { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } },
      );
    },
    [getToken],
  );
}
