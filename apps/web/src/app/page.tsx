'use client';
import { useState } from 'react';

export default function HomePage() {
  const [creating, setCreating] = useState(false);

  async function createRoom() {
    setCreating(true);
    try {
      const r = await fetch('./api/room/create', { method: 'POST' });
      const j = await r.json();
      location.href = `./room/${j.id}`;
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="flex flex-col items-center gap-6">
      <h1 className="text-3xl font-semibold">SupiChat</h1>
      <p className="text-neutral-300 text-center max-w-xl">Start a quick video room and share the link. Each user picks a language. Incoming messages auto-translate for the reader.</p>
      <button onClick={createRoom} disabled={creating} className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50">
        {creating ? 'Creating…' : 'Start Chat'}
      </button>
    </main>
  );
}


