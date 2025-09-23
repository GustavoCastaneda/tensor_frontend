// components/Sidebar.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Home, Book, PanelLeftClose } from "lucide-react";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export function Sidebar() {
  const [open, setOpen] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Evitar hidratación incorrecta
  useEffect(() => {
    setMounted(true);
  }, []);

  // No renderizar hasta que esté montado en el cliente
  if (!mounted) {
    return (
      <aside className="w-48 flex flex-col bg-[#fafaf9] text-black transition-all duration-300 overflow-hidden border-r border-gray-200 pt-2">
        <div className="p-4">
          <div className="h-8 flex items-center justify-center">
            <div className="w-40 h-38 relative transition-all duration-300">
              <Image
                src="/Logo completo gray scale (14).png"
                alt="Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          <div className="flex items-center gap-3 p-4">
            <Home size={20} />
            <span>Dashboard</span>
          </div>
          <div className="flex items-center gap-3 p-4">
            <Book size={20} />
            <span>Knowledge</span>
          </div>
        </nav>
        <div className="p-4 border-t border-neutral-300">
          <div className="space-y-2">
            <div className="flex items-center justify-center">
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={`${
        open ? "w-48" : "w-16"
      } flex flex-col bg-[#fafaf9] text-black transition-all duration-300 overflow-hidden border-r border-gray-200 pt-2`}
    >
      {/* Logo Space */}
      <div className="p-4">
        <div className={`${open ? "h-8" : "h-8"} flex items-center justify-center`}>
          {/* Logo Image */}
          <div className={`${open ? "w-40 h-38" : "w-10 h-10"} relative transition-all duration-300`}>
            <Image
              src={open ? "/Logo completo gray scale (14).png" : "/Encabezado (6).png"}
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

      {/* User Section */}
      <div className="p-4 border-t border-neutral-300">
        <div className="space-y-2">
          {/* User Authentication */}
          <div className="flex items-center justify-center">
            <SignedOut>
              <div className={`flex ${open ? 'gap-2' : 'flex-col gap-1'}`}>
                <SignInButton>
                  <button className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                    {open ? 'Sign In' : 'In'}
                  </button>
                </SignInButton>
                <SignUpButton>
                  <button className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors">
                    {open ? 'Sign Up' : 'Up'}
                  </button>
                </SignUpButton>
              </div>
            </SignedOut>
            <SignedIn>
              <div className="flex items-center justify-center">
                <UserButton 
                  appearance={{
                    elements: {
                      avatarBox: "w-8 h-8"
                    }
                  }}
                />
                {open && <span className="ml-2 text-sm text-gray-700">Profile</span>}
              </div>
            </SignedIn>
          </div>

          {/* Toggle Button */}
          <div className="flex justify-center">
            <button
              onClick={() => setOpen(!open)}
              className="p-2 hover:bg-neutral-300 focus:outline-none rounded transition-colors"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>
        </div>
      </div>
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