'use client';
import { useState } from 'react';

export default function SimplePage() {
  const [creating, setCreating] = useState(false);
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '/supichat';

  async function createRoom() {
    setCreating(true);
    try {
      const r = await fetch(`${base}/api/room/create`, { method: 'POST' });
      const j = await r.json();
      if (j.id) {
        location.href = `${base}/room/${j.id}`;
      }
    } catch (err) {
      alert('Failed to create room');
    } finally {
      setCreating(false);
    }
  }

  const styles = {
    container: {
      backgroundColor: '#111827',
      color: '#ffffff',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    },
    content: {
      maxWidth: '400px',
      textAlign: 'center' as const,
      backgroundColor: 'rgba(31, 41, 55, 0.92)',
      padding: '2rem',
      borderRadius: '0.5rem',
      border: '1px solid #4b5563'
    },
    title: {
      fontSize: '2.5rem',
      fontWeight: 'bold',
      marginBottom: '1rem'
    },
    subtitle: {
      fontSize: '1.1rem',
      color: '#d1d5db',
      marginBottom: '2rem'
    },
    button: {
      backgroundColor: '#2563eb',
      color: 'white',
      border: 'none',
      padding: '0.75rem 2rem',
      borderRadius: '0.5rem',
      fontSize: '1rem',
      cursor: creating ? 'not-allowed' : 'pointer',
      opacity: creating ? 0.5 : 1,
      width: '100%'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>SupiChat</h1>
        <p style={styles.subtitle}>
          Video conferencing with real-time translation
        </p>
        <button 
          onClick={createRoom} 
          disabled={creating}
          style={styles.button}
        >
          {creating ? 'Creating room...' : 'New meeting'}
        </button>
      </div>
    </div>
  );
}