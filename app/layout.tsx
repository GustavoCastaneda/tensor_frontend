import { ClerkProvider, SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import './globals.css';

export const metadata = {
  title: 'Tensor Workspace',
  description: 'Clerk + Next.js example',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>           {/* contexto de autenticación */}
      <html lang="en">
        <body>
          <header className=" p-4 border-b flex gap-4">
            <SignedOut>
              <SignInButton />
              <SignUpButton />
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
