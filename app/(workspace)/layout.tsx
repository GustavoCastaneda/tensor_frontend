import NavAuth from "@/src/components/NavAuth";
import { Sidebar } from "@/src/components/Sidebar"; // tu sidebar
import { ClerkProvider } from "@clerk/nextjs";
import "../globals.css";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <div className="min-h-screen flex">
        <Sidebar />
        {/* Columna derecha: topbar + contenido */}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-12 border-b px-4 flex items-center justify-end">
            <NavAuth />
          </header>
          <main className="flex-1 overflow-auto p-4 bg-neutral-100">
            {children}
          </main>
        </div>
      </div>
    </ClerkProvider>
  );
}
