// app/(workspace)/layout.tsx
import { Sidebar } from "@/src/components/Sidebar";


export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />                       {/* fijo a la izquierda */}
      <main className="flex-1 overflow-y-auto p-4 bg-[#f1f1f1]">{children}</main>
    </div>
  );
}
