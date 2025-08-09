import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'SupiChat',
  description: 'Minimal video chat with auto-translating messages',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="mx-auto max-w-6xl p-4">{children}</div>
      </body>
    </html>
  );
}


