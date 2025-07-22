// middleware.ts — sin opciones: todos los helpers disponibles
import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware()

export const config = {
  matcher: [
    // ➊ ignora estáticos y la carpeta interna _next
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // ➋ siempre corre en rutas API
    '/(api|trpc)(.*)',
  ],
}
