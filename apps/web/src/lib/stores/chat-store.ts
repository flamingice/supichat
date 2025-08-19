/**
 * Chat state management store
 * Handles messages and translations
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface ChatMessage {
  id: string;
  from?: string;
  name?: string;
  original: string;
  translated?: string;
  timestamp: number;
}

interface ChatState {
  messageIds: string[];
  messagesById: Record<string, ChatMessage>;
  chatInput: string;
  unreadCount: number;
}

interface ChatStore extends ChatState {
  actions: {
    addMessage: (message: Omit<ChatMessage, 'timestamp'>) => void;
    updateMessageTranslation: (messageId: string, translated: string) => void;
    setChatInput: (input: string) => void;
    clearUnreadCount: () => void;
    incrementUnreadCount: () => void;
    clearChat: () => void;
  };
}

export const useChatStore = create<ChatStore>()(
  subscribeWithSelector((set) => ({
    messageIds: [],
    messagesById: {},
    chatInput: '',
    unreadCount: 0,
    
    actions: {
      addMessage: (message) => set((s) => {
        const id = message.id;
        const timestamp = Date.now();
        const fullMessage = { ...message, timestamp };
        
        return {
          ...s,
          messageIds: [...s.messageIds, id],
          messagesById: { ...s.messagesById, [id]: fullMessage }
        };
      }),
      
      updateMessageTranslation: (messageId, translated) => set((s) => {
        const message = s.messagesById[messageId];
        if (!message) return s;
        
        return {
          ...s,
          messagesById: {
            ...s.messagesById,
            [messageId]: { ...message, translated }
          }
        };
      }),
      
      setChatInput: (chatInput) => set((s) => ({ ...s, chatInput })),
      
      clearUnreadCount: () => set((s) => ({ ...s, unreadCount: 0 })),
      
      incrementUnreadCount: () => set((s) => ({ ...s, unreadCount: s.unreadCount + 1 })),
      
      clearChat: () => set(() => ({
        messageIds: [],
        messagesById: {},
        chatInput: '',
        unreadCount: 0
      }))
    }
  }))
);

// Selectors
export const useChat = () => useChatStore(s => ({
  messageIds: s.messageIds,
  messagesById: s.messagesById,
  chatInput: s.chatInput,
  unreadCount: s.unreadCount
}));

export const useChatActions = () => useChatStore(s => s.actions);
export const useMessage = (messageId: string) => useChatStore(s => s.messagesById[messageId]);
export const useChatInput = () => useChatStore(s => s.chatInput);
export const useUnreadCount = () => useChatStore(s => s.unreadCount);
export const useMessages = () => useChatStore(s => 
  s.messageIds.map(id => s.messagesById[id]).filter(Boolean)
);