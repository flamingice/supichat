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
        <div className="mx-auto max-w-6xl p-4">
          <header className="glass flex items-center justify-between px-3 py-2 mb-4" style={{height:58}}>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500" />
              <div className="font-semibold tracking-wide">supichat</div>
            </div>
            <div className="text-xs text-neutral-400">personal video chat</div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}




