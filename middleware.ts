import {
    clerkMiddleware,
    createRouteMatcher,
  } from "@clerk/nextjs/server";
  import { NextResponse } from "next/server";
  
  const isProtected = createRouteMatcher([
    "/dashboard(.*)",
    "/profile(.*)",
    "/upload(.*)",
  ]);
  
  export default clerkMiddleware(async (auth, req) => {
    if (isProtected(req)) {
      const { userId } = await auth();
  
      if (!userId) {
        // No hay sesión ⇒ redirige a /sign-in con return URL
        const signIn = new URL("/sign-in", req.url);
        signIn.searchParams.set("redirect_url", req.url);
  
        return NextResponse.redirect(signIn);   // 307 Redirect
      }
    }
    // Rutas públicas pasan directo
  });
  
  export const config = { matcher: ["/((?!_next|.*\\..*).*)"] };
  