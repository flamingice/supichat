/**
 * Connection state management store
 * Handles room connection and status
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface ConnectionState {
  roomId: string | null;
  joined: boolean;
  socketConnected: boolean;
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
}

interface ConnectionStore extends ConnectionState {
  actions: {
    setConnectionState: (state: Partial<ConnectionState>) => void;
    joinRoom: (roomId: string) => void;
    leaveRoom: () => void;
    setSocketConnected: (connected: boolean) => void;
    setStatus: (status: ConnectionState['status']) => void;
  };
}

export const useConnectionStore = create<ConnectionStore>()(
  subscribeWithSelector((set) => ({
    roomId: null,
    joined: false,
    socketConnected: false,
    status: 'connecting',
    
    actions: {
      setConnectionState: (state) => set((s) => ({ ...s, ...state })),
      
      joinRoom: (roomId) => set((s) => ({
        ...s,
        roomId,
        joined: true,
        status: 'connected'
      })),
      
      leaveRoom: () => set(() => ({
        roomId: null,
        joined: false,
        socketConnected: false,
        status: 'connecting'
      })),
      
      setSocketConnected: (socketConnected) => set((s) => ({ ...s, socketConnected })),
      
      setStatus: (status) => set((s) => ({ ...s, status }))
    }
  }))
);

// Selectors
export const useConnection = () => useConnectionStore(s => ({
  roomId: s.roomId,
  joined: s.joined,
  socketConnected: s.socketConnected,
  status: s.status
}));

export const useConnectionActions = () => useConnectionStore(s => s.actions);
export const useRoomId = () => useConnectionStore(s => s.roomId);
export const useConnectionStatus = () => useConnectionStore(s => s.status);