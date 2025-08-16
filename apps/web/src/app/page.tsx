'use client';
import { useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function HomePage() {
  const [creating, setCreating] = useState(false);
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '/supichat';

  async function createRoom() {
    setCreating(true);
    try {
      const r = await fetch(`${base}/api/room/create`, { method: 'POST' });
      
      if (!r.ok) {
        if (r.status === 429) {
          const errorData = await r.json().catch(() => ({}));
          alert(`Rate limit exceeded. ${errorData.message || 'Please try again later.'}`);
          return;
        }
        throw new Error(`Failed to create room: ${r.status}`);
      }
      
      const j = await r.json();
      if (!j.id) {
        throw new Error('Invalid response from server');
      }
      
      location.href = `${base}/room/${j.id}`;
    } catch (err: any) {
      console.error('Room creation failed:', err);
      alert(`Failed to create room: ${err.message || 'Please try again.'}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <ErrorBoundary>
      <main className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="tile p-4 flex flex-col gap-3 justify-center items-center min-h-56">
          <h1 className="text-2xl font-semibold">SupiChat</h1>
          <p className="text-neutral-300 text-center max-w-xl">Minimal video chat with auto-translating messages. Share the link, pick your language, and start talking.</p>
          <button onClick={createRoom} disabled={creating} className="btn btn-accent disabled:opacity-50">
            {creating ? 'Creating…' : 'Start a room'}
          </button>
        </div>
        <div className="tile p-4">
          <div className="text-sm text-neutral-300 mb-2">How it works</div>
          <ul className="list-disc ml-6 space-y-1 text-neutral-300">
            <li>Create a room and share the link</li>
            <li>Allow mic/camera and pick your language</li>
            <li>Messages auto-translate for the reader</li>
          </ul>
        </div>
      </main>
    </ErrorBoundary>
  );
}




