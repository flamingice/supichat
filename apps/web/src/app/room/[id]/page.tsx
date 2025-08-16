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
};

type Signal = { from: string; data: any };

export default function RoomPage({ params }: { params: { id: string } }) {
  const roomId = params.id;
  const [name, setName] = useState('');
  const [lang, setLang] = useState(process.env.NEXT_PUBLIC_DEFAULT_LANG || 'en');
  const [ready, setReady] = useState(false);
  const [joined, setJoined] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<{ id: string; from?: string; name?: string; original: string; translated?: string }[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcMap = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreams = useRef<Map<string, MediaStream>>(new Map());
  const [peers, setPeers] = useState<RemotePeer[]>([]);

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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setReady(true);
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

    socket.on('peer-joined', async ({ id, name }) => {
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
    socketRef.current?.emit('join', { roomId, name });
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
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-4">
        {!joined ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="px-3 py-2 rounded bg-neutral-800 w-full" />
              <select value={lang} onChange={e => setLang(e.target.value)} className="px-3 py-2 rounded bg-neutral-800">
                {LANGS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              <button onClick={joinRoom} className="px-4 py-2 rounded bg-green-600 hover:bg-green-500">Join</button>
            </div>
            <div className="text-sm text-neutral-400">Room: {roomId}</div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-52 bg-black rounded" />
          {peers.map(p => (
            <video key={p.id} autoPlay playsInline className="w-full h-52 bg-black rounded" ref={el => { if (el && p.stream) el.srcObject = p.stream; }} />
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={() => toggleTrack('audio')} className="px-3 py-2 rounded bg-neutral-800">Mute/Unmute</button>
          <button onClick={() => toggleTrack('video')} className="px-3 py-2 rounded bg-neutral-800">Video On/Off</button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-lg font-semibold">Chat</div>
        <div className="h-96 overflow-auto rounded bg-neutral-900 p-3 space-y-2">
          {messages.map(m => (
            <div key={m.id} className="text-sm">
              {m.name ? <span className="text-neutral-400 mr-2">{m.name}:</span> : null}
              <div><span className="text-neutral-300">{m.original}</span></div>
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
  );
}


