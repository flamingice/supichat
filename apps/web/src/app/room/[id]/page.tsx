'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { LANGS, getLangLabel } from '@/lib/i18n';
import { ErrorBoundary, VideoErrorBoundary } from '@/components/ErrorBoundary';

const SIGNALING_PATH = process.env.NEXT_PUBLIC_SIGNALING_PATH || '/supichat/socket.io';
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/supichat';

type RemotePeer = {
  id: string;
  name?: string;
  stream?: MediaStream;
  micEnabled?: boolean;
  camEnabled?: boolean;
  lang?: string;
};

type Signal = { from: string; data: any };

export default function RoomPage({ params }: { params: { id: string } }) {
  const roomId = params.id;
  const [name, setName] = useState('');
  const [lang, setLang] = useState(process.env.NEXT_PUBLIC_DEFAULT_LANG || 'en');
  const [ready, setReady] = useState(false);
  const [joined, setJoined] = useState(false);
  const [localMicEnabled, setLocalMicEnabled] = useState(true);
  const [localCamEnabled, setLocalCamEnabled] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'people' | 'chat'>('chat');
  const [unread, setUnread] = useState(0);
  const [pinnedPeerId, setPinnedPeerId] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [micId, setMicId] = useState<string | undefined>(undefined);
  const [camId, setCamId] = useState<string | undefined>(undefined);
  const [speakerId, setSpeakerId] = useState<string | undefined>(undefined);

  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ id: string; from?: string; name?: string; original: string; translated?: string }[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcMap = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreams = useRef<Map<string, MediaStream>>(new Map());
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const mutedPeerIdsRef = useRef<Set<string>>(new Set());

  const iceServers = useMemo(() => {
    const s: RTCIceServer[] = [];
    const stun1 = process.env.NEXT_PUBLIC_STUN_1;
    if (stun1) s.push({ urls: stun1 });
    const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
    const turnU = process.env.NEXT_PUBLIC_TURN_USERNAME;
    const turnP = process.env.NEXT_PUBLIC_TURN_CRED;
    if (turnUrl && turnU && turnP) s.push({ urls: turnUrl, username: turnU, credential: turnP });
    return s.length ? s : [{ urls: 'stun:stun.l.google.com:19302' }];
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const isE2E = typeof location !== 'undefined' && new URLSearchParams(location.search).get('e2e') === '1';
        if (isE2E) {
          setLocalMicEnabled(true);
          setLocalCamEnabled(true);
          setMics([{ deviceId: 'e2e-mic', kind: 'audioinput', label: 'E2E Mic' } as any]);
          setCams([{ deviceId: 'e2e-cam', kind: 'videoinput', label: 'E2E Cam' } as any]);
          setSpeakers([{ deviceId: 'e2e-spk', kind: 'audiooutput', label: 'E2E Speaker' } as any]);
          setReady(true);
          return;
        }
        const constraints: MediaStreamConstraints = { video: true, audio: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        const mic = stream.getAudioTracks()[0];
        const cam = stream.getVideoTracks()[0];
        setLocalMicEnabled(Boolean(mic?.enabled ?? true));
        setLocalCamEnabled(Boolean(cam?.enabled ?? true));

        // Enumerate devices
        const devs = await navigator.mediaDevices.enumerateDevices();
        setMics(devs.filter(d => d.kind === 'audioinput'));
        setCams(devs.filter(d => d.kind === 'videoinput'));
        setSpeakers(devs.filter(d => d.kind === 'audiooutput'));
        setMicId(stream.getAudioTracks()[0]?.getSettings().deviceId);
        setCamId(stream.getVideoTracks()[0]?.getSettings().deviceId);

        // Simple mic level
        const audioCtx = new AudioContext();
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(buf);
          const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
          setMicLevel(Math.round(avg));
          requestAnimationFrame(tick);
        };
        tick();

        setReady(true);
      } catch (err: any) {
        setPermissionError('Camera/Microphone permission denied. You can still join without devices.');
        setLocalStream(null);
        setLocalMicEnabled(false);
        setLocalCamEnabled(false);
        setReady(true);
      }
    })();
  }, []);

  // Persist chat per room in sessionStorage while connected
  useEffect(() => {
    if (!joined) return;
    try {
      const key = `supichat:messages:${roomId}`;
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setMessages(arr);
      }
    } catch {}
  }, [joined, roomId]);

  useEffect(() => {
    if (!ready) return;
    // Determine signaling origin:
    // 1) Use explicit env override when provided.
    // 2) Local dev: localhost -> :4001.
    // 3) Direct port access (non-80/443): same host on :4001.
    // 4) Otherwise assume reverse proxy on same origin.
    let SIGNALING_ORIGIN = process.env.NEXT_PUBLIC_SIGNALING_ORIGIN || '';
    if (!SIGNALING_ORIGIN && typeof location !== 'undefined') {
      const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      const nonStandardPort = location.port && location.port !== '80' && location.port !== '443';
      if (isLocal) {
        SIGNALING_ORIGIN = 'http://localhost:4001';
      } else if (nonStandardPort) {
        SIGNALING_ORIGIN = `${location.protocol}//${location.hostname}:4001`;
      } else {
        SIGNALING_ORIGIN = location.origin; // reverse proxy expected to route /supichat/socket.io
      }
    }
  const socket = io(SIGNALING_ORIGIN, { path: SIGNALING_PATH });
    socketRef.current = socket;

    socket.on('connect', () => {
      // no-op
    });

    socket.on('peers', async (list: { id: string; name?: string; lang?: string }[]) => {
      setPeers(prev => {
        const existing = new Set(prev.map(p => p.id));
        const merged = [...prev];
        for (const it of list) {
          if (!existing.has(it.id)) merged.push({ id: it.id, name: it.name, lang: it.lang });
        }
        return merged;
      });
      // As the new joiner, prepare peer connections; existing peers will initiate via 'peer-joined'.
      for (const it of list) {
        try {
          await connectToPeer(it.id, it.name, false);
        } catch {}
      }
    });

    socket.on('peer-joined', async ({ id, name }) => {
      setPeers(p => (p.some(pe => pe.id === id) ? p : [...p, { id, name }]));
      await connectToPeer(id, name, true);
    });

    socket.on('signal', async ({ from, data }: Signal) => {
      let pc = pcMap.current.get(from);
      if (!pc) {
        const peerName = undefined; // unnamed until chat mentions it
        pc = await createPCForPeer(from, peerName);
        pcMap.current.set(from, pc);
      }
      if (data.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        if (data.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('signal', { roomId, targetId: from, data: { sdp: answer } });
        }
      } else if (data.candidate) {
        try { await pc.addIceCandidate(data.candidate); } catch {}
      }
    });

    socket.on('peer-left', ({ id }) => {
      const pc = pcMap.current.get(id);
      if (pc) pc.close();
      pcMap.current.delete(id);
      remoteStreams.current.delete(id);
      setPeers(p => p.filter(pe => pe.id !== id));
      mutedPeerIdsRef.current.delete(id);
    });

    socket.on('peer-state', ({ id, micEnabled, camEnabled }) => {
      setPeers(p => p.map(pe => pe.id === id ? { ...pe, name: pe.name, stream: pe.stream } : pe));
      // We do not yet render mic/cam from peers, but reserved here for future display.
    });

    socket.on('chat', async ({ from, name, msg, lang: srcLang }) => {
      const id = uuidv4();
      const myLang = lang;
      let translated = '';
      try {
        if (srcLang !== myLang) {
          const r = await fetch(`${BASE_PATH}/api/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: msg, targetLang: myLang })
          });
          const j = await r.json();
          translated = j.translated || '';
        }
      } catch {}
      setMessages(m => [...m, { id, from, name, original: msg, translated }]);
    });

    return () => {
      socket.disconnect();
      pcMap.current.forEach(pc => pc.close());
      pcMap.current.clear();
  try { sessionStorage.removeItem(`supichat:messages:${roomId}`); } catch {}
    };
  }, [ready, lang]);

  async function createPCForPeer(peerId: string, peerName?: string) {
    const pc = new RTCPeerConnection({ iceServers });
    if (localStream) localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current?.emit('signal', { roomId, targetId: peerId, data: { candidate: e.candidate } });
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      remoteStreams.current.set(peerId, stream);
      setPeers(p => {
        const exists = p.some(pe => pe.id === peerId);
        if (exists) return p.map(pe => pe.id === peerId ? { ...pe, name: peerName, stream } : pe);
        return [...p, { id: peerId, name: peerName, stream }];
      });
    };

    return pc;
  }

  async function connectToPeer(peerId: string, peerName?: string, isCaller?: boolean) {
    let pc = pcMap.current.get(peerId);
    if (!pc) {
      pc = await createPCForPeer(peerId, peerName);
      pcMap.current.set(peerId, pc);
    }
    if (isCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('signal', { roomId, targetId: peerId, data: { sdp: offer } });
    }
  }

  function joinRoom() {
    if (!name || !lang) return;
    socketRef.current?.emit('join', { roomId, name, lang });
    setJoined(true);
  }

  function sendChat() {
    if (!chatInput.trim()) return;
    socketRef.current?.emit('chat', { roomId, msg: chatInput, lang });
    setMessages(m => [...m, { id: uuidv4(), original: chatInput }]);
    setChatInput('');
  }

  // Persist messages while connected
  useEffect(() => {
    if (!joined) return;
    try { sessionStorage.setItem(`supichat:messages:${roomId}`, JSON.stringify(messages)); } catch {}
  }, [messages, joined, roomId]);

  async function toggleTrack(kind: 'audio' | 'video') {
    if (!localStream) return;
    const tracks = kind === 'audio' ? localStream.getAudioTracks() : localStream.getVideoTracks();
    tracks.forEach(t => t.enabled = !t.enabled);
    if (kind === 'audio') {
      const t = localStream.getAudioTracks()[0];
      setLocalMicEnabled(Boolean(t?.enabled ?? true));
    } else {
      const t = localStream.getVideoTracks()[0];
      setLocalCamEnabled(Boolean(t?.enabled ?? true));
    }
    // Inform others of local state
    socketRef.current?.emit('state', { roomId, micEnabled: localMicEnabled, camEnabled: localCamEnabled });
  }

  function togglePeerMute(peerId: string) {
    const set = mutedPeerIdsRef.current;
    if (set.has(peerId)) set.delete(peerId); else set.add(peerId);
    setPeers(p => [...p]);
  }

  function isPeerMuted(peerId: string) {
    return mutedPeerIdsRef.current.has(peerId);
  }

  function copyInvite() {
    const origin = typeof location !== 'undefined' ? location.origin : '';
    const link = `${origin}${BASE_PATH}/room/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  function leaveRoom() {
    socketRef.current?.disconnect();
    pcMap.current.forEach(pc => pc.close());
    pcMap.current.clear();
    if (typeof location !== 'undefined') {
      location.href = `${BASE_PATH}`;
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-medium text-white">SupiChat</h1>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="bg-gray-700 px-2 py-1 rounded text-xs">{roomId}</span>
            <button 
              data-testid="copy-link" 
              onClick={copyInvite} 
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
              title="Copy meeting link"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
              </svg>
              Copy link
            </button>
            {copied && <span className="text-green-400 text-xs">Copied!</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
            </svg>
            <span>{1 + peers.length} participants</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(s => !s)} 
            className="meet-btn text-sm"
            title="Meeting details"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>

      {!joined ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Video preview */}
            <div className="flex flex-col items-center">
              <VideoErrorBoundary>
                <div className="video-tile w-full max-w-md mb-4">
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover" 
                  />
                  {!localCamEnabled && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                      <div className="text-center">
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M21 6.5l-4 4V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11z"/>
                          <path d="M2 2l20 20" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        <p className="text-gray-400 text-sm">Camera off</p>
                      </div>
                    </div>
                  )}
                  <div className="video-name">You</div>
                  {/* Mic level indicator */}
                  {localMicEnabled && (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 px-2 py-1 rounded">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                        <path d="M10 2C5.03 2 1 6.03 1 11s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zM7 7l6 6M7 13l6-6"/>
                      </svg>
                      <div className="w-8 h-1 bg-gray-600 rounded-full overflow-hidden">
                        <div 
                          className="h-1 bg-green-500 transition-all" 
                          style={{ width: `${Math.min(100, Math.max(4, micLevel/2))}%` }} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </VideoErrorBoundary>
              
              {/* Media controls */}
              <div className="flex gap-3 mb-6">
                <button 
                  data-testid="toggle-mic" 
                  onClick={() => toggleTrack('audio')} 
                  className={`meet-btn-icon ${localMicEnabled ? '' : 'danger'}`}
                  title={localMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {localMicEnabled ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 102 0V5z" clipRule="evenodd"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.22 2.22a.75.75 0 011.06 0L6.56 5.5H9a.75.75 0 010 1.5H8.06l3.94 3.94V14a.75.75 0 01-1.5 0v-2.44l-6.28-6.28a.75.75 0 010-1.06z" clipRule="evenodd"/>
                    </svg>
                  )}
                </button>
                <button 
                  data-testid="toggle-cam" 
                  onClick={() => toggleTrack('video')} 
                  className={`meet-btn-icon ${localCamEnabled ? '' : 'danger'}`}
                  title={localCamEnabled ? 'Turn off camera' : 'Turn on camera'}
                >
                  {localCamEnabled ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M21 6.5l-4 4V7a1 1 0 00-1-1H9.83l8.17 8.17v-7.67zM3.83 2L2 3.83 4.02 5.85C4.01 5.9 4 5.95 4 6v10c0 .55.45 1 1 1h12c.05 0 .1-.01.15-.02L20 19.83 21.83 18 3.83 2z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Setup form */}
            <div className="meet-card p-6 h-fit">
              <h2 className="text-xl font-medium text-white mb-6">Ready to join?</h2>
              
              {permissionError && (
                <div className="bg-yellow-600/20 border border-yellow-600/30 rounded-lg p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                    </svg>
                    <div>
                      <p className="text-yellow-200 text-sm font-medium">Camera/microphone access</p>
                      <p className="text-yellow-300 text-sm">{permissionError}</p>
                      <button 
                        onClick={() => location.reload()} 
                        className="text-yellow-400 hover:text-yellow-300 text-sm underline mt-1"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Your name</label>
                  <input 
                    data-testid="name" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="meet-input" 
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Language</label>
                  <select data-testid="lang" value={lang} onChange={e => setLang(e.target.value)} className="meet-select">
                    {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Microphone</label>
                    <select data-testid="mic-device" value={micId} onChange={e => setMicId(e.target.value)} className="meet-select text-sm">
                      {mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Camera</label>
                    <select data-testid="cam-device" value={camId} onChange={e => setCamId(e.target.value)} className="meet-select text-sm">
                      {cams.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default'}</option>)}
                    </select>
                  </div>
                </div>

                <button 
                  data-testid="join-btn" 
                  onClick={joinRoom} 
                  disabled={!ready || !name} 
                  className="meet-btn-primary w-full text-lg py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Join meeting
                </button>

                <p className="text-gray-400 text-xs text-center">
                  By joining, you agree to our terms of service
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row">
          {/* Main video area */}
          <div className={`flex-1 flex flex-col ${sidebarOpen ? 'md:mr-80' : ''} transition-all duration-300`}>
            <div className="p-4 md:flex-1">
              <VideoErrorBoundary>
                {/* On mobile, constrain to half viewport height */}
                <div className="video-grid h-[50vh] md:h-full">
                  {/* Local video */}
                  <div className="video-tile">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="video-overlay">
                      <div className="video-name">You</div>
                      <div className="absolute top-2 right-2 flex gap-1">
                        {!localMicEnabled && (
                          <div className="bg-red-600 rounded-full p-1">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M2.22 2.22a.75.75 0 011.06 0L6.56 5.5H9a.75.75 0 010 1.5H8.06l3.94 3.94V14a.75.75 0 01-1.5 0v-2.44l-6.28-6.28a.75.75 0 010-1.06z" clipRule="evenodd"/>
                            </svg>
                          </div>
                        )}
                        {!localCamEnabled && (
                          <div className="bg-red-600 rounded-full p-1">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 4a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4z"/>
                              <path d="M2 2l16 16" stroke="currentColor" strokeWidth="2"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      {localMicEnabled && (
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 px-2 py-1 rounded">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <div className="w-8 h-1 bg-gray-600 rounded-full overflow-hidden">
                            <div 
                              className="h-1 bg-green-500 transition-all" 
                              style={{ width: `${Math.min(100, Math.max(4, micLevel/2))}%` }} 
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Remote peers */}
                  {peers.map(p => (
                    <div key={p.id} className="video-tile group">
                      <video
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                        ref={el => {
                          if (el && p.stream) {
                            (el as any).srcObject = p.stream;
                            el.muted = isPeerMuted(p.id);
                          }
                        }}
                      />
                      <div className="video-overlay">
                        <div className="video-name">
                          <span>{p.name || 'Guest'}</span>
                          {p.lang && <span className="ml-1 text-xs bg-gray-600 px-1 rounded">{p.lang.toUpperCase()}</span>}
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button 
                            onClick={() => setPinnedPeerId(p.id === pinnedPeerId ? null : p.id)} 
                            className="bg-black/70 hover:bg-black/90 rounded-full p-1 transition-colors"
                            title="Pin participant"
                          >
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"/>
                            </svg>
                          </button>
                          <button 
                            onClick={() => togglePeerMute(p.id)} 
                            className={`rounded-full p-1 transition-colors ${isPeerMuted(p.id) ? 'bg-red-600 hover:bg-red-700' : 'bg-black/70 hover:bg-black/90'}`}
                            title={isPeerMuted(p.id) ? 'Unmute' : 'Mute locally'}
                          >
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              {isPeerMuted(p.id) ? (
                                <path fillRule="evenodd" d="M2.22 2.22a.75.75 0 011.06 0L6.56 5.5H9a.75.75 0 010 1.5H8.06l3.94 3.94V14a.75.75 0 01-1.5 0v-2.44l-6.28-6.28a.75.75 0 010-1.06z" clipRule="evenodd"/>
                              ) : (
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                              )}
                            </svg>
                          </button>
                        </div>
                        <div className="absolute bottom-2 left-2 flex items-center gap-1">
                          {isPeerMuted(p.id) ? (
                            <div className="bg-red-600 rounded-full p-1">
                              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M2.22 2.22a.75.75 0 011.06 0L6.56 5.5H9a.75.75 0 010 1.5H8.06l3.94 3.94V14a.75.75 0 01-1.5 0v-2.44l-6.28-6.28a.75.75 0 010-1.06z" clipRule="evenodd"/>
                              </svg>
                            </div>
                          ) : (
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </VideoErrorBoundary>
            </div>

            {/* Meet-style control bar */}
            <div className="control-bar">
              <button 
                data-testid="toggle-mic" 
                onClick={() => toggleTrack('audio')} 
                className={`meet-btn-icon ${localMicEnabled ? '' : 'danger'}`}
                title={localMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                {localMicEnabled ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 102 0V5z" clipRule="evenodd"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.22 2.22a.75.75 0 011.06 0L6.56 5.5H9a.75.75 0 010 1.5H8.06l3.94 3.94V14a.75.75 0 01-1.5 0v-2.44l-6.28-6.28a.75.75 0 010-1.06z" clipRule="evenodd"/>
                  </svg>
                )}
              </button>

              <button 
                data-testid="toggle-cam" 
                onClick={() => toggleTrack('video')} 
                className={`meet-btn-icon ${localCamEnabled ? '' : 'danger'}`}
                title={localCamEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {localCamEnabled ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 6.5l-4 4V7a1 1 0 00-1-1H9.83l8.17 8.17v-7.67zM3.83 2L2 3.83 4.02 5.85C4.01 5.9 4 5.95 4 6v10c0 .55.45 1 1 1h12c.05 0 .1-.01.15-.02L20 19.83 21.83 18 3.83 2z"/>
                  </svg>
                )}
              </button>

              <button 
                data-testid="share" 
                className="meet-btn-icon disabled" 
                title="Screen sharing not available" 
                disabled
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h14a1 1 0 011 1v11a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm2 2v7h12V5H4z"/>
                  <path d="M10 15l3-3H7l3 3z"/>
                </svg>
              </button>

              <div className="w-px h-6 bg-gray-600"></div>

              <button 
                data-testid="open-chat" 
                onClick={() => { setSidebarOpen(true); setSidebarTab('chat'); }} 
                className="meet-btn-icon relative"
                title="Open chat"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H7l-4 4V5z"/>
                </svg>
                {unread > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unread}
                  </div>
                )}
              </button>

              <button 
                data-testid="open-people" 
                onClick={() => { setSidebarOpen(true); setSidebarTab('people'); }} 
                className="meet-btn-icon relative"
                title="Show participants"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                </svg>
                <div data-testid="participants-count" className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {1 + peers.length}
                </div>
              </button>

              <div className="w-px h-6 bg-gray-600"></div>

              <button 
                onClick={leaveRoom} 
                className="meet-btn-danger text-sm px-4"
                title="Leave meeting"
              >
                Leave
              </button>
            </div>
          </div>

          {/* Mobile chat: always visible, lower half, scrollable */}
          <div className="block md:hidden h-[50vh]" data-testid="mobile-panel">
            <ErrorBoundary>
              <div className="chat-container h-full overflow-auto">
                <div className="flex items-center justify-between p-4 border-b border-gray-600">
                  <div className="flex bg-gray-700 rounded-lg">
                    <button className={`px-3 py-1 text-sm rounded-lg transition-colors ${sidebarTab === 'people' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'}`} onClick={() => setSidebarTab('people')}>People</button>
                    <button className={`px-3 py-1 text-sm rounded-lg transition-colors ${sidebarTab === 'chat' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'}`} onClick={() => setSidebarTab('chat')}>Chat</button>
                  </div>
                  <div className="text-sm text-gray-400">{1 + peers.length} participants</div>
                </div>

                {sidebarTab === 'people' ? (
                  <div className="p-4" data-testid="people-list">
                    <div data-testid="participants-header" className="text-sm text-gray-400 mb-4">{1 + peers.length} participants</div>
                    <div className="space-y-2">
                      {[{id:'you', name}, ...peers].map(p => (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                            {(p.name || 'U')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">
                              {p.id === 'you' ? `${name} (You)` : (p.name || 'Guest')}
                            </div>
                            {p.id === 'you' && (
                              <div className="text-xs text-gray-400">{lang.toUpperCase()}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {p.id === 'you' ? (
                              localMicEnabled ? (
                                <div className="w-2 h-2 bg-green-500 rounded-full" title="Microphone on"></div>
                              ) : (
                                <div className="w-2 h-2 bg-red-500 rounded-full" title="Microphone off"></div>
                              )
                            ) : (
                              <div className="w-2 h-2 bg-green-500 rounded-full" title="Active"></div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="p-4 border-b border-gray-600">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-400">Auto-translate to:</div>
                        <select 
                          data-testid="viewer-lang" 
                          value={lang} 
                          onChange={e => setLang(e.target.value)} 
                          className="meet-select text-xs"
                        >
                          {LANGS.map(l => <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>)}
                        </select>
                      </div>
                    </div>
                    
                    <div data-testid="chat-list" className="flex-1 overflow-auto p-4 space-y-3">
                      {messages.map(m => (
                        <div 
                          key={m.id} 
                          data-testid="msg" 
                          data-author={m.name ? 'peer' : 'self'} 
                          className={`flex ${m.name ? '' : 'justify-end'}`}
                        >
                          <div className={`max-w-xs ${m.name ? 'chat-message' : 'chat-message own'}`}>
                            <div className="text-xs text-gray-300 mb-1">{m.name || 'You'}</div>
                            {m.translated ? (
                              <div className="text-sm text-white mb-1" data-translated>{m.translated}</div>
                            ) : null}
                            <div className="text-xs text-gray-400" data-original>
                              {m.translated ? `Original: ${m.original}` : m.original}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="p-4 border-t border-gray-600">
                      <div className="flex gap-2">
                        <input 
                          data-testid="chat-input" 
                          value={chatInput} 
                          onChange={e => setChatInput(e.target.value)} 
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } }} 
                          className="meet-input text-sm" 
                          placeholder={`Message (${getLangLabel(lang)})`} 
                        />
                        <button 
                          data-testid="chat-send" 
                          onClick={sendChat} 
                          className="meet-btn-primary px-3"
                          title="Send message"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ErrorBoundary>
          </div>

      {/* Desktop sidebar */}
      {sidebarOpen && (
            <ErrorBoundary>
        <div className="hidden md:block chat-container w-80 fixed top-0 right-0 h-full" data-testid="sidebar">
                {/* reuse the same content as mobile chat header/body */}
                <div className="flex items-center justify-between p-4 border-b border-gray-600">
                  <div className="flex bg-gray-700 rounded-lg">
                    <button className={`px-3 py-1 text-sm rounded-lg transition-colors ${sidebarTab === 'people' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'}`} onClick={() => setSidebarTab('people')}>People</button>
                    <button className={`px-3 py-1 text-sm rounded-lg transition-colors ${sidebarTab === 'chat' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'}`} onClick={() => setSidebarTab('chat')}>Chat</button>
                  </div>
                  <button className="text-gray-400 hover:text-white p-1" onClick={() => setSidebarOpen(false)} title="Close sidebar">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                  </button>
                </div>

                {sidebarTab === 'people' ? (
                  <div className="p-4" data-testid="people-list">
                    <div data-testid="participants-header" className="text-sm text-gray-400 mb-4">{1 + peers.length} participants</div>
                    <div className="space-y-2">
                      {[{id:'you', name}, ...peers].map(p => (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700 transition-colors">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                            {(p.name || 'U')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white truncate">
                              {p.id === 'you' ? `${name} (You)` : (p.name || 'Guest')}
                            </div>
                            {p.id === 'you' && (
                              <div className="text-xs text-gray-400">{lang.toUpperCase()}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {p.id === 'you' ? (
                              localMicEnabled ? (
                                <div className="w-2 h-2 bg-green-500 rounded-full" title="Microphone on"></div>
                              ) : (
                                <div className="w-2 h-2 bg-red-500 rounded-full" title="Microphone off"></div>
                              )
                            ) : (
                              <div className="w-2 h-2 bg-green-500 rounded-full" title="Active"></div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="p-4 border-b border-gray-600">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-400">Auto-translate to:</div>
                        <select data-testid="viewer-lang" value={lang} onChange={e => setLang(e.target.value)} className="meet-select text-xs">
                          {LANGS.map(l => <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>)}
                        </select>
                      </div>
                    </div>
                    
                    <div data-testid="chat-list" className="flex-1 overflow-auto p-4 space-y-3">
                      {messages.map(m => (
                        <div key={m.id} data-testid="msg" data-author={m.name ? 'peer' : 'self'} className={`flex ${m.name ? '' : 'justify-end'}`}>
                          <div className={`max-w-xs ${m.name ? 'chat-message' : 'chat-message own'}`}>
                            <div className="text-xs text-gray-300 mb-1">{m.name || 'You'}</div>
                            {m.translated ? (<div className="text-sm text-white mb-1" data-translated>{m.translated}</div>) : null}
                            <div className="text-xs text-gray-400" data-original>
                              {m.translated ? `Original: ${m.original}` : m.original}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="p-4 border-t border-gray-600">
                      <div className="flex gap-2">
                        <input data-testid="chat-input" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } }} className="meet-input text-sm" placeholder={`Message (${getLangLabel(lang)})`} />
                        <button data-testid="chat-send" onClick={sendChat} className="meet-btn-primary px-3" title="Send message">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ErrorBoundary>
          )}
        </div>
      )}
    </div>
  );
}


