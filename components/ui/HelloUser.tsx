"use client";

import { useUser } from "@clerk/nextjs";

export function HelloUser() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="text-sm text-gray-600 animate-pulse font-montserrat">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-sm text-gray-600 font-montserrat font-bold">
        Hello Guest
      </div>
    );
  }

  // Obtener el nombre del usuario
  const firstName = user.firstName || user.fullName?.split(' ')[0] || 'User';
  const displayName = firstName;

  return (
    <div className="text-4xl text-black font-montserrat font-light">
      Hello {displayName}, welcome!
    </div>
  );
}