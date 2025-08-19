/**
 * Optimized Zustand store for room state management
 * Replaces multiple useState hooks with targeted subscriptions
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

export interface ChatMessage {
  id: string;
  from?: string;
  name?: string;
  original: string;
  translated?: string;
  timestamp: number;
}

interface ConnectionState {
  roomId: string | null;
  joined: boolean;
  socketConnected: boolean;
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
}

interface PeersState {
  peerOrder: string[];
  peerMap: Record<string, Peer>;
  pinnedPeerId: string | null;
}

interface MediaState {
  local: {
    micEnabled: boolean;
    camEnabled: boolean;
    screenEnabled: boolean;
    selectedMicId?: string;
    selectedCamId?: string;
    micLevel: number;
  };
  devices: {
    mics: MediaDeviceInfo[];
    cams: MediaDeviceInfo[];
    speakers: MediaDeviceInfo[];
  };
}

interface ChatState {
  messageIds: string[];
  messagesById: Record<string, ChatMessage>;
  chatInput: string;
  unreadCount: number;
}

interface UIState {
  panels: {
    sidebarOpen: boolean;
    sidebarTab: 'people' | 'chat';
  };
  layout: {
    gridMode: 'auto' | 'spotlight';
    pinnedId?: string;
  };
  user: {
    name: string;
    lang: string;
  };
}

interface RoomStore {
  connection: ConnectionState;
  peers: PeersState;
  media: MediaState;
  chat: ChatState;
  ui: UIState;
  actions: {
    // Connection actions
    setConnectionState: (state: Partial<ConnectionState>) => void;
    joinRoom: (roomId: string, name: string, lang: string) => void;
    leaveRoom: () => void;
    
    // Peer actions
    upsertPeer: (peer: Peer) => void;
    removePeer: (peerId: string) => void;
    setPeerState: (peerId: string, state: Partial<Peer>) => void;
    setPeerSpeaking: (peerId: string, speaking: boolean) => void;
    setPeerAudioLevel: (peerId: string, level: number) => void;
    setPinnedPeer: (peerId: string | null) => void;
    
    // Media actions
    setLocalMediaState: (state: Partial<MediaState['local']>) => void;
    setDevices: (devices: Partial<MediaState['devices']>) => void;
    toggleMic: () => void;
    toggleCam: () => void;
    setMicLevel: (level: number) => void;
    
    // Chat actions
    addMessage: (message: Omit<ChatMessage, 'timestamp'>) => void;
    updateMessageTranslation: (messageId: string, translated: string) => void;
    setChatInput: (input: string) => void;
    clearUnreadCount: () => void;
    
    // UI actions
    toggleSidebar: () => void;
    setSidebarTab: (tab: 'people' | 'chat') => void;
    setLayout: (layout: Partial<UIState['layout']>) => void;
    setUser: (user: Partial<UIState['user']>) => void;
  };
}

export const useRoomStore = create<RoomStore>()(
  subscribeWithSelector((set, get) => ({
    connection: {
      roomId: null,
      joined: false,
      socketConnected: false,
      status: 'connecting'
    },
    
    peers: {
      peerOrder: [],
      peerMap: {},
      pinnedPeerId: null
    },
    
    media: {
      local: {
        micEnabled: true,
        camEnabled: true,
        screenEnabled: false,
        micLevel: 0
      },
      devices: {
        mics: [],
        cams: [],
        speakers: []
      }
    },
    
    chat: {
      messageIds: [],
      messagesById: {},
      chatInput: '',
      unreadCount: 0
    },
    
    ui: {
      panels: {
        sidebarOpen: false,
        sidebarTab: 'chat'
      },
      layout: {
        gridMode: 'auto'
      },
      user: {
        name: '',
        lang: process.env.NEXT_PUBLIC_DEFAULT_LANG || 'en'
      }
    },
    
    actions: {
      // Connection actions
      setConnectionState: (state) => set((s) => ({
        connection: { ...s.connection, ...state }
      })),
      
      joinRoom: (roomId, name, lang) => set((s) => ({
        connection: { ...s.connection, roomId, joined: true },
        ui: { ...s.ui, user: { ...s.ui.user, name, lang } }
      })),
      
      leaveRoom: () => set((s) => ({
        connection: { roomId: null, joined: false, socketConnected: false, status: 'connecting' },
        peers: { peerOrder: [], peerMap: {}, pinnedPeerId: null },
        chat: { messageIds: [], messagesById: {}, chatInput: '', unreadCount: 0 }
      })),
      
      // Peer actions
      upsertPeer: (peer) => set((s) => {
        const exists = Boolean(s.peers.peerMap[peer.id]);
        const peerOrder = exists ? s.peers.peerOrder : [...s.peers.peerOrder, peer.id];
        return {
          peers: {
            ...s.peers,
            peerOrder,
            peerMap: {
              ...s.peers.peerMap,
              [peer.id]: { ...(s.peers.peerMap[peer.id] ?? {}), ...peer }
            }
          }
        };
      }),
      
      removePeer: (peerId) => set((s) => {
        const { [peerId]: removed, ...peerMap } = s.peers.peerMap;
        return {
          peers: {
            ...s.peers,
            peerOrder: s.peers.peerOrder.filter(id => id !== peerId),
            peerMap,
            pinnedPeerId: s.peers.pinnedPeerId === peerId ? null : s.peers.pinnedPeerId
          }
        };
      }),
      
      setPeerState: (peerId, state) => set((s) => {
        const peer = s.peers.peerMap[peerId];
        if (!peer) return {};
        return {
          peers: {
            ...s.peers,
            peerMap: {
              ...s.peers.peerMap,
              [peerId]: { ...peer, ...state }
            }
          }
        };
      }),
      
      setPeerSpeaking: (peerId, speaking) => set((s) => {
        const peer = s.peers.peerMap[peerId];
        if (!peer || peer.speaking === speaking) return {};
        return {
          peers: {
            ...s.peers,
            peerMap: {
              ...s.peers.peerMap,
              [peerId]: { ...peer, speaking }
            }
          }
        };
      }),
      
      setPeerAudioLevel: (peerId, level) => set((s) => {
        const peer = s.peers.peerMap[peerId];
        if (!peer || Math.abs((peer.audioLevel ?? 0) - level) < 0.05) return {};
        return {
          peers: {
            ...s.peers,
            peerMap: {
              ...s.peers.peerMap,
              [peerId]: { ...peer, audioLevel: level }
            }
          }
        };
      }),
      
      setPinnedPeer: (peerId) => set((s) => ({
        peers: { ...s.peers, pinnedPeerId: peerId }
      })),
      
      // Media actions
      setLocalMediaState: (state) => set((s) => ({
        media: {
          ...s.media,
          local: { ...s.media.local, ...state }
        }
      })),
      
      setDevices: (devices) => set((s) => ({
        media: {
          ...s.media,
          devices: { ...s.media.devices, ...devices }
        }
      })),
      
      toggleMic: () => set((s) => ({
        media: {
          ...s.media,
          local: { ...s.media.local, micEnabled: !s.media.local.micEnabled }
        }
      })),
      
      toggleCam: () => set((s) => ({
        media: {
          ...s.media,
          local: { ...s.media.local, camEnabled: !s.media.local.camEnabled }
        }
      })),
      
      setMicLevel: (level) => set((s) => ({
        media: {
          ...s.media,
          local: { ...s.media.local, micLevel: level }
        }
      })),
      
      // Chat actions
      addMessage: (message) => set((s) => {
        const id = message.id;
        const timestamp = Date.now();
        const fullMessage = { ...message, timestamp };
        
        return {
          chat: {
            ...s.chat,
            messageIds: [...s.chat.messageIds, id],
            messagesById: { ...s.chat.messagesById, [id]: fullMessage },
            unreadCount: s.ui.panels.sidebarTab !== 'chat' ? s.chat.unreadCount + 1 : s.chat.unreadCount
          }
        };
      }),
      
      updateMessageTranslation: (messageId, translated) => set((s) => {
        const message = s.chat.messagesById[messageId];
        if (!message) return {};
        
        return {
          chat: {
            ...s.chat,
            messagesById: {
              ...s.chat.messagesById,
              [messageId]: { ...message, translated }
            }
          }
        };
      }),
      
      setChatInput: (input) => set((s) => ({
        chat: { ...s.chat, chatInput: input }
      })),
      
      clearUnreadCount: () => set((s) => ({
        chat: { ...s.chat, unreadCount: 0 }
      })),
      
      // UI actions
      toggleSidebar: () => set((s) => ({
        ui: {
          ...s.ui,
          panels: { ...s.ui.panels, sidebarOpen: !s.ui.panels.sidebarOpen }
        }
      })),
      
      setSidebarTab: (tab) => set((s) => ({
        ui: {
          ...s.ui,
          panels: { ...s.ui.panels, sidebarTab: tab }
        }
      })),
      
      setLayout: (layout) => set((s) => ({
        ui: {
          ...s.ui,
          layout: { ...s.ui.layout, ...layout }
        }
      })),
      
      setUser: (user) => set((s) => ({
        ui: {
          ...s.ui,
          user: { ...s.ui.user, ...user }
        }
      }))
    }
  }))
);

// Selectors for common use cases
export const useConnection = () => useRoomStore(s => s.connection);
export const usePeers = () => useRoomStore(s => s.peers);
export const useLocalMedia = () => useRoomStore(s => s.media.local);
export const useChat = () => useRoomStore(s => s.chat);
export const useUI = () => useRoomStore(s => s.ui);

// Specific selectors to minimize re-renders
export const usePeerIds = () => useRoomStore(s => s.peers.peerOrder);
export const usePeer = (peerId: string) => useRoomStore(s => s.peers.peerMap[peerId]);
export const useMessage = (messageId: string) => useRoomStore(s => s.chat.messagesById[messageId]);
export const useActions = () => useRoomStore(s => s.actions);