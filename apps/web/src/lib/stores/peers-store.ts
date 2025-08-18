/**
 * Peers state management store
 * Handles peer tracking and pinning
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface Peer {
  id: string;
  name?: string;
  lang?: string;
  micEnabled?: boolean;
  camEnabled?: boolean;
  speaking?: boolean;
  audioLevel?: number;
}

interface PeersState {
  peerOrder: string[];
  peerMap: Record<string, Peer>;
  pinnedPeerId: string | null;
}

interface PeersStore extends PeersState {
  actions: {
    upsertPeer: (peer: Peer) => void;
    removePeer: (peerId: string) => void;
    setPeerState: (peerId: string, state: Partial<Peer>) => void;
    setPeerSpeaking: (peerId: string, speaking: boolean) => void;
    setPeerAudioLevel: (peerId: string, level: number) => void;
    setPinnedPeer: (peerId: string | null) => void;
    clearAllPeers: () => void;
  };
}

export const usePeersStore = create<PeersStore>()(
  subscribeWithSelector((set) => ({
    peerOrder: [],
    peerMap: {},
    pinnedPeerId: null,
    
    actions: {
      upsertPeer: (peer) => set((s) => {
        const exists = Boolean(s.peerMap[peer.id]);
        const peerOrder = exists ? s.peerOrder : [...s.peerOrder, peer.id];
        return {
          ...s,
          peerOrder,
          peerMap: {
            ...s.peerMap,
            [peer.id]: { ...(s.peerMap[peer.id] ?? {}), ...peer }
          }
        };
      }),
      
      removePeer: (peerId) => set((s) => {
        const { [peerId]: removed, ...peerMap } = s.peerMap;
        return {
          ...s,
          peerOrder: s.peerOrder.filter(id => id !== peerId),
          peerMap,
          pinnedPeerId: s.pinnedPeerId === peerId ? null : s.pinnedPeerId
        };
      }),
      
      setPeerState: (peerId, state) => set((s) => {
        const peer = s.peerMap[peerId];
        if (!peer) return s;
        return {
          ...s,
          peerMap: {
            ...s.peerMap,
            [peerId]: { ...peer, ...state }
          }
        };
      }),
      
      setPeerSpeaking: (peerId, speaking) => set((s) => {
        const peer = s.peerMap[peerId];
        if (!peer || peer.speaking === speaking) return s;
        return {
          ...s,
          peerMap: {
            ...s.peerMap,
            [peerId]: { ...peer, speaking }
          }
        };
      }),
      
      setPeerAudioLevel: (peerId, level) => set((s) => {
        const peer = s.peerMap[peerId];
        if (!peer || Math.abs((peer.audioLevel ?? 0) - level) < 0.05) return s;
        return {
          ...s,
          peerMap: {
            ...s.peerMap,
            [peerId]: { ...peer, audioLevel: level }
          }
        };
      }),
      
      setPinnedPeer: (peerId) => set((s) => ({ ...s, pinnedPeerId: peerId })),
      
      clearAllPeers: () => set(() => ({
        peerOrder: [],
        peerMap: {},
        pinnedPeerId: null
      }))
    }
  }))
);

// Selectors
export const usePeers = () => usePeersStore(s => ({
  peerOrder: s.peerOrder,
  peerMap: s.peerMap,
  pinnedPeerId: s.pinnedPeerId
}));

export const usePeersActions = () => usePeersStore(s => s.actions);
export const usePeerIds = () => usePeersStore(s => s.peerOrder);
export const usePeer = (peerId: string) => usePeersStore(s => s.peerMap[peerId]);
export const usePinnedPeer = () => usePeersStore(s => s.pinnedPeerId);