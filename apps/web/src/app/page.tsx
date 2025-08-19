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
      {/* Defensive wrapper to ensure contrast if CSS not loaded */}
      <div className="hero-container">
        <div className="hero-content">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-8">SupiChat</h1>
            <p className="text-xl text-gray-300 mb-8">
              Premium video conferencing with real-time translation. 
              Connect globally, communicate naturally.
            </p>
          </div>

          {/* Main card */}
          <div className="meet-card p-8 max-w-md mx-auto text-center">
            <div className="mb-8">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              </div>
              <h2 className="text-2xl font-medium text-white mb-2">Ready to connect?</h2>
              <p className="text-gray-400">
                Start a new meeting and invite others to join your conversation.
              </p>
            </div>

            <button 
              onClick={createRoom} 
              disabled={creating} 
              className="meet-btn-primary w-full text-lg py-3 mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating room...
                </div>
              ) : (
                'New meeting'
              )}
            </button>

            <div className="border-t border-gray-600 pt-6">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Key features</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  Real-time translation
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  HD video & audio
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  Secure & private
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 text-gray-500 text-sm">
            No downloads required • Works in your browser
          </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}




