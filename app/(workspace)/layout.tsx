import { Sidebar } from "@/src/components/Sidebar"; // tu sidebar
import { ClerkProvider } from "@clerk/nextjs";
import "../globals.css";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <div className="min-h-screen flex">
        <Sidebar />
        {/* Columna derecha: contenido */}
        <div className="flex-1 min-w-0 flex flex-col">
          <main className="flex-1 overflow-hidden bg-white">
            {children}
          </main>
        </div>
      </div>
    </ClerkProvider>
  );
}