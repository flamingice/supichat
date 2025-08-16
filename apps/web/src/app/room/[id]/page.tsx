'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { LANGS, getLangLabel } from '@/lib/i18n';

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
        setPermissionError('Camera/Microphone permission denied.');
      }
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const SIGNALING_ORIGIN = process.env.NEXT_PUBLIC_SIGNALING_ORIGIN ||
      (typeof location !== 'undefined' && location.hostname === 'localhost' && location.port === '3000'
        ? 'http://localhost:4001'
        : (typeof location !== 'undefined' ? location.origin : ''));
    const socket = io(SIGNALING_ORIGIN, { path: SIGNALING_PATH, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      // no-op
    });

    socket.on('peers', (list: { id: string; name?: string; lang?: string }[]) => {
      setPeers(prev => {
        const existing = new Set(prev.map(p => p.id));
        const merged = [...prev];
        for (const it of list) {
          if (!existing.has(it.id)) merged.push({ id: it.id, name: it.name });
        }
        return merged;
      });
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
    <div className="space-y-4">
      {/* Top bar inside room */}
      <div className="glass flex items-center justify-between px-3 py-2" style={{height:56}}>
        <div className="flex items-center gap-3">
          <div className="font-semibold tracking-wide">Room {roomId}</div>
          <button data-testid="copy-link" onClick={copyInvite} className="pill hover:bg-white/10" title="Copy link">🔗 Copy</button>
          {copied ? <span className="text-xs text-green-400">Copied</span> : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-300">
          <span className="badge">{1 + peers.length} people</span>
          <button onClick={() => setSidebarOpen(s => !s)} className="pill hover:bg-white/10">⚙ Settings</button>
        </div>
      </div>

      {!joined ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="tile p-3 relative">
            <div className="aspect-video bg-black rounded-xl overflow-hidden">
              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {!localCamEnabled ? (<div className="absolute inset-0 flex items-center justify-center text-neutral-400">🚫📷</div>) : null}
            </div>
            {/* mic level */}
            <div className="absolute left-3 bottom-3 h-2 w-40 bg-black/50 rounded-full overflow-hidden">
              <div className="h-2 bg-green-500" style={{ width: `${Math.min(100, Math.max(4, micLevel/2))}%` }} />
            </div>
          </div>
          <div className="tile p-4 space-y-3">
            {permissionError ? (
              <div className="rounded bg-red-500/15 text-red-300 text-sm px-3 py-2 flex items-center justify-between">
                <span>{permissionError}</span>
                <button className="pill" onClick={() => location.reload()}>Retry</button>
              </div>
            ) : null}
            <div className="space-y-1">
              <div className="text-sm text-neutral-300">Your name</div>
              <input data-testid="name" value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 rounded bg-neutral-800 border border-white/10" placeholder="e.g., Alex" />
            </div>
            <div className="space-y-1">
              <div className="text-sm text-neutral-300">My chat language</div>
              <select data-testid="lang" value={lang} onChange={e => setLang(e.target.value)} className="w-full px-3 py-2 rounded bg-neutral-800 border border-white/10">
                {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="text-sm text-neutral-300">Microphone</div>
                <select data-testid="mic-device" value={micId} onChange={e => setMicId(e.target.value)} className="w-full px-3 py-2 rounded bg-neutral-800 border border-white/10">
                  {mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-neutral-300">Camera</div>
                <select data-testid="cam-device" value={camId} onChange={e => setCamId(e.target.value)} className="w-full px-3 py-2 rounded bg-neutral-800 border border-white/10">
                  {cams.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-neutral-300">Speaker</div>
              <select data-testid="spk-device" value={speakerId} onChange={e => setSpeakerId(e.target.value)} className="w-full px-3 py-2 rounded bg-neutral-800 border border-white/10">
                {speakers.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Speaker'}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <button data-testid="toggle-mic" onClick={() => toggleTrack('audio')} className={`btn ${localMicEnabled ? '' : 'btn-danger'}`}>{localMicEnabled ? '🎤 Mic on' : '🔇 Mic off'}</button>
              <button data-testid="toggle-cam" onClick={() => toggleTrack('video')} className={`btn ${localCamEnabled ? '' : 'btn-danger'}`}>{localCamEnabled ? '📷 Cam on' : '🚫📷 Cam off'}</button>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-neutral-300">Room link</div>
              <div className="flex gap-2">
                <input data-testid="room-link" readOnly className="w-full px-3 py-2 rounded bg-neutral-800 border border-white/10" value={`${typeof location!=='undefined'?location.origin:''}${BASE_PATH}/room/${roomId}`} />
                <button data-testid="copy-room-link" onClick={copyInvite} className="btn">Copy</button>
              </div>
            </div>
            <button data-testid="join-btn" onClick={joinRoom} disabled={!ready || !name} className="btn btn-accent w-full disabled:opacity-50">Join now</button>
            <div className="text-xs text-neutral-400">Grant access to your camera and microphone to join.</div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-52 bg-black rounded" />
                  <div className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs">You</div>
                  {!localMicEnabled ? <div className="absolute right-2 top-2 rounded bg-error px-2 py-0.5 text-xs" style={{background:'var(--error)'}}>Mic off</div> : null}
                  {!localCamEnabled ? <div className="absolute right-2 top-7 rounded px-2 py-0.5 text-xs" style={{background:'var(--error)'}}>Cam off</div> : null}
                </div>
                {peers.map(p => (
                  <div key={p.id} className="relative">
                    <video
                      autoPlay
                      playsInline
                      className="w-full h-52 bg-black rounded"
                      ref={el => {
                        if (el && p.stream) {
                          (el as any).srcObject = p.stream;
                          el.muted = isPeerMuted(p.id);
                        }
                      }}
                    />
                    <div className="absolute left-2 bottom-2 glass px-2 py-1 text-xs flex items-center gap-2">
                      <span>{p.name || 'Guest'}</span>
                      <span className="badge">{(p.lang || '').toUpperCase()}</span>
                      <span title={isPeerMuted(p.id) ? 'Muted locally' : 'Live'}>{isPeerMuted(p.id) ? '🔇' : '🎤'}</span>
                    </div>
                    <div className="absolute right-2 top-2 flex gap-2">
                      <button onClick={() => setPinnedPeerId(p.id === pinnedPeerId ? null : p.id)} className="pill hover:bg-white/10" title="Pin">📌</button>
                      <button onClick={() => togglePeerMute(p.id)} className="pill hover:bg-white/10" title={isPeerMuted(p.id)?'Unmute':'Mute'}>{isPeerMuted(p.id)?'Unmute':'Mute'}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-lg font-semibold">Chat</div>
              <div className="h-96 overflow-auto rounded bg-neutral-900 p-3 space-y-2">
                {messages.map(m => (
                  <div key={m.id} className="text-sm">
                    {m.name ? <span className="text-neutral-400 mr-2">{m.name}:</span> : null}
                    <div className={`${m.name ? '' : 'text-right'}`}>
                      <span className={`inline-block px-2 py-1 rounded ${m.name ? 'bg-neutral-800 text-neutral-200' : 'bg-blue-600 text-white'}`}>{m.original}</span>
                    </div>
                    {m.translated && <div className="text-green-400">{m.translated}</div>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder={`Message (${getLangLabel(lang)})`} className="px-3 py-2 rounded bg-neutral-800 w-full" />
                <button onClick={sendChat} className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-500">Send</button>
              </div>
            </div>
          </div>

          {/* Bottom control bar */}
          <div className="fixed bottom-4 left-0 right-0 pointer-events-none">
            <div className="pointer-events-auto mx-auto w-fit glass px-3 py-2 rounded-2xl flex items-center gap-2" style={{height:68}}>
              <button data-testid="toggle-mic" onClick={() => toggleTrack('audio')} className={`btn ${localMicEnabled ? '' : 'btn-danger'}`} title="Mic">{localMicEnabled?'🎤':'🔇'}</button>
              <button data-testid="toggle-cam" onClick={() => toggleTrack('video')} className={`btn ${localCamEnabled ? '' : 'btn-danger'}`} title="Camera">{localCamEnabled?'📷':'🚫📷'}</button>
              <button data-testid="share" className="btn" title="Share screen" disabled>🖥️</button>
              <button data-testid="open-chat" onClick={() => { setSidebarOpen(true); setSidebarTab('chat'); }} className="btn" title="Chat">💬{unread>0?<span className="badge ml-1">{unread}</span>:null}</button>
              <button data-testid="open-people" onClick={() => { setSidebarOpen(true); setSidebarTab('people'); }} className="btn" title="People">👥<span className="badge ml-1">{1+peers.length}</span></button>
              <button onClick={() => setSidebarOpen(true)} className="btn" title="Settings">⚙</button>
              <button onClick={leaveRoom} className="btn btn-danger" title="Leave">Leave</button>
            </div>
          </div>

          {/* Right sidebar drawer */}
          {sidebarOpen ? (
            <div data-testid="drawer" className="fixed top-0 right-0 h-full w-[380px] glass p-3 space-y-3 overflow-auto">
              <div className="flex items-center justify-between">
                <div className="flex gap-2 text-sm">
                  <button className={`pill ${sidebarTab==='people'?'bg-white/10':''}`} onClick={()=>setSidebarTab('people')}>People</button>
                  <button className={`pill ${sidebarTab==='chat'?'bg-white/10':''}`} onClick={()=>setSidebarTab('chat')}>Chat</button>
                </div>
                <button className="pill" onClick={()=>setSidebarOpen(false)}>✕</button>
              </div>
              {sidebarTab==='people' ? (
                <div className="space-y-2">
                  <div className="text-sm text-neutral-400">{1+peers.length} in room</div>
                  {[{id:'you', name}, ...peers].map(p => (
                    <div key={p.id} className="flex items-center justify-between tile p-2">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">{(p.name||'U')[0]}</div>
                        <div className="text-sm">{p.id==='you' ? `${name} (You)` : (p.name || 'Guest')}</div>
                        {p.id==='you' ? <span className="badge">{lang.toUpperCase()}</span> : null}
                      </div>
                      <div className="text-sm text-neutral-400">{p.id==='you'? (localMicEnabled?'🎤':'🔇') : '🎤'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-neutral-400">Messages auto-translate</div>
                    <select data-testid="viewer-lang" value={lang} onChange={e=>setLang(e.target.value)} className="px-2 py-1 rounded bg-neutral-800 border border-white/10 text-sm">
                      {LANGS.map(l => <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div data-testid="chat-list" className="flex-1 overflow-auto space-y-2">
                    {messages.map(m => (
                      <div key={m.id} data-testid="msg" data-author={m.name ? 'peer' : 'self'} className="text-sm tile p-2">
                        <div className="text-xs text-neutral-400">{m.name || 'You'}</div>
                        {m.translated ? (
                          <div className="text-[15px] text-neutral-100" data-translated>{m.translated}</div>
                        ) : null}
                        <div className="text-xs text-neutral-400" data-original>Original: {m.original}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input data-testid="chat-input" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } }} className="w-full px-3 py-2 rounded bg-neutral-800 border border-white/10" placeholder={`Message (auto-translated to ${getLangLabel(lang)})`} />
                    <button data-testid="chat-send" onClick={sendChat} className="btn">➤</button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}


