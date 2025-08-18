/**
 * UI state management store
 * Handles layout, panels, and user preferences
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface PanelsState {
  sidebarOpen: boolean;
  sidebarTab: 'people' | 'chat';
}

interface LayoutState {
  gridMode: 'auto' | 'spotlight';
  pinnedId?: string;
}

interface UserState {
  name: string;
  lang: string;
}

interface UIStore {
  panels: PanelsState;
  layout: LayoutState;
  user: UserState;
  actions: {
    // Panel actions
    toggleSidebar: () => void;
    setSidebarOpen: (open: boolean) => void;
    setSidebarTab: (tab: 'people' | 'chat') => void;
    
    // Layout actions
    setLayout: (layout: Partial<LayoutState>) => void;
    setGridMode: (gridMode: LayoutState['gridMode']) => void;
    setPinnedId: (pinnedId?: string) => void;
    
    // User actions
    setUser: (user: Partial<UserState>) => void;
    setUserName: (name: string) => void;
    setUserLang: (lang: string) => void;
  };
}

export const useUIStore = create<UIStore>()(
  subscribeWithSelector((set) => ({
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
    },
    
    actions: {
      // Panel actions
      toggleSidebar: () => set((s) => ({
        ...s,
        panels: { ...s.panels, sidebarOpen: !s.panels.sidebarOpen }
      })),
      
      setSidebarOpen: (sidebarOpen) => set((s) => ({
        ...s,
        panels: { ...s.panels, sidebarOpen }
      })),
      
      setSidebarTab: (sidebarTab) => set((s) => ({
        ...s,
        panels: { ...s.panels, sidebarTab }
      })),
      
      // Layout actions
      setLayout: (layout) => set((s) => ({
        ...s,
        layout: { ...s.layout, ...layout }
      })),
      
      setGridMode: (gridMode) => set((s) => ({
        ...s,
        layout: { ...s.layout, gridMode }
      })),
      
      setPinnedId: (pinnedId) => set((s) => ({
        ...s,
        layout: { ...s.layout, pinnedId }
      })),
      
      // User actions
      setUser: (user) => set((s) => ({
        ...s,
        user: { ...s.user, ...user }
      })),
      
      setUserName: (name) => set((s) => ({
        ...s,
        user: { ...s.user, name }
      })),
      
      setUserLang: (lang) => set((s) => ({
        ...s,
        user: { ...s.user, lang }
      }))
    }
  }))
);

// Selectors
export const useUI = () => useUIStore(s => ({
  panels: s.panels,
  layout: s.layout,
  user: s.user
}));

export const useUIActions = () => useUIStore(s => s.actions);
export const usePanels = () => useUIStore(s => s.panels);
export const useLayout = () => useUIStore(s => s.layout);
export const useUser = () => useUIStore(s => s.user);
export const useSidebarOpen = () => useUIStore(s => s.panels.sidebarOpen);
export const useSidebarTab = () => useUIStore(s => s.panels.sidebarTab);
export const useGridMode = () => useUIStore(s => s.layout.gridMode);
export const useUserName = () => useUIStore(s => s.user.name);
export const useUserLang = () => useUIStore(s => s.user.lang);