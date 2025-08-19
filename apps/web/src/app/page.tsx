export default function HomePage() {
  return (
    <div style={{
      backgroundColor: '#111827',
      color: '#ffffff',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '400px',
        textAlign: 'center' as const,
        backgroundColor: 'rgba(31, 41, 55, 0.92)',
        padding: '2rem',
        borderRadius: '0.5rem',
        border: '1px solid #4b5563'
      }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 'bold',
          marginBottom: '1rem'
        }}>SupiChat</h1>
        <p style={{
          fontSize: '1.1rem',
          color: '#d1d5db',
          marginBottom: '2rem'
        }}>
          Video conferencing with real-time translation
        </p>
        <button 
          id="create-room-btn"
          style={{
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            padding: '0.75rem 2rem',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          New meeting
        </button>
        
        <script dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('DOMContentLoaded', function() {
              const btn = document.getElementById('create-room-btn');
              if (btn) {
                btn.addEventListener('click', async function() {
                  this.textContent = 'Creating room...';
                  this.disabled = true;
                  this.style.opacity = '0.5';
                  this.style.cursor = 'not-allowed';
                  
                  try {
                    const response = await fetch('/supichat/api/room/create', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' }
                    });
                    const data = await response.json();
                    if (data.id) {
                      window.location.href = '/supichat/room/' + data.id;
                    }
                  } catch (error) {
                    console.error('Room creation failed:', error);
                    alert('Failed to create room');
                    this.textContent = 'New meeting';
                    this.disabled = false;
                    this.style.opacity = '1';
                    this.style.cursor = 'pointer';
                  }
                });
              }
            });
          `
        }} />
      </div>
    </div>
  );
}