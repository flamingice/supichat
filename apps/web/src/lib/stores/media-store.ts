/**
 * Media state management store
 * Handles local media controls and device enumeration
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface LocalMediaState {
  micEnabled: boolean;
  camEnabled: boolean;
  screenEnabled: boolean;
  selectedMicId?: string;
  selectedCamId?: string;
  micLevel: number;
}

interface DevicesState {
  mics: MediaDeviceInfo[];
  cams: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
}

interface MediaStore {
  local: LocalMediaState;
  devices: DevicesState;
  actions: {
    setLocalMediaState: (state: Partial<LocalMediaState>) => void;
    setDevices: (devices: Partial<DevicesState>) => void;
    toggleMic: () => void;
    toggleCam: () => void;
    toggleScreen: () => void;
    setMicLevel: (level: number) => void;
    setSelectedMic: (deviceId?: string) => void;
    setSelectedCam: (deviceId?: string) => void;
  };
}

export const useMediaStore = create<MediaStore>()(
  subscribeWithSelector((set) => ({
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
    },
    
    actions: {
      setLocalMediaState: (state) => set((s) => ({
        ...s,
        local: { ...s.local, ...state }
      })),
      
      setDevices: (devices) => set((s) => ({
        ...s,
        devices: { ...s.devices, ...devices }
      })),
      
      toggleMic: () => set((s) => ({
        ...s,
        local: { ...s.local, micEnabled: !s.local.micEnabled }
      })),
      
      toggleCam: () => set((s) => ({
        ...s,
        local: { ...s.local, camEnabled: !s.local.camEnabled }
      })),
      
      toggleScreen: () => set((s) => ({
        ...s,
        local: { ...s.local, screenEnabled: !s.local.screenEnabled }
      })),
      
      setMicLevel: (level) => set((s) => ({
        ...s,
        local: { ...s.local, micLevel: level }
      })),
      
      setSelectedMic: (selectedMicId) => set((s) => ({
        ...s,
        local: { ...s.local, selectedMicId }
      })),
      
      setSelectedCam: (selectedCamId) => set((s) => ({
        ...s,
        local: { ...s.local, selectedCamId }
      }))
    }
  }))
);

// Selectors
export const useLocalMedia = () => useMediaStore(s => s.local);
export const useDevices = () => useMediaStore(s => s.devices);
export const useMediaActions = () => useMediaStore(s => s.actions);
export const useMicEnabled = () => useMediaStore(s => s.local.micEnabled);
export const useCamEnabled = () => useMediaStore(s => s.local.camEnabled);
export const useScreenEnabled = () => useMediaStore(s => s.local.screenEnabled);
export const useMicLevel = () => useMediaStore(s => s.local.micLevel);