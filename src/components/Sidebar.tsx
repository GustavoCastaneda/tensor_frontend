// components/Sidebar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Home, Book } from "lucide-react";

export function Sidebar() {
  const [open, setOpen] = useState(true);

  return (
    <aside
      className={`${
        open ? "w-40" : "w-16"
      } flex flex-col bg-neutral-200 text-black transition-all duration-300 h-screen max-h-screen min-h-screen overflow-hidden`}
    >
      {/* Logo Space */}
      <div className="p-4 border-b border-neutral-300">
        <div className={`${open ? "h-8" : "h-8"} flex items-center justify-center`}>
          {/* Logo Image */}
          <div className={`${open ? "w-10 h-10" : "w-10 h-10"} relative transition-all duration-300`}>
            <Image
              src="/Encabezado (6).png"
              alt="Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
      </div>

      {/* Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto">
        <NavItem href="/dashboard" label="Dashboard" icon={<Home size={20} />} open={open} />
        <NavItem href="/knowledge" label="Knowledge" icon={<Book size={20} />} open={open} />
      </nav>

      {/* Toggle Button - Bottom Right
      <div className="p-4">
        <div className="flex justify-end">
          <button
            onClick={() => setOpen(!open)}
            className="p-2 hover:bg-neutral-300 focus:outline-none rounded"
          >
            ☰
          </button>
        </div>
      </div> */}
    </aside>
  );
}

function NavItem({
  href,
  label,
  icon,
  open,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  open: boolean;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 p-4 hover:bg-neutral-300">
      {icon}
      {open && <span>{label}</span>}
    </Link>
  );
}
