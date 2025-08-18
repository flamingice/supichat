/**
 * Main store exports for easy imports
 * Re-exports all focused stores and their selectors
 */

// Re-export all stores and their hooks
export * from './connection-store';
export * from './peers-store';
export * from './media-store';
export * from './chat-store';
export * from './ui-store';

// Export the original room store for backward compatibility during migration
export { useRoomStore, useActions as useRoomActions } from './room-store';

// Combined actions for convenience (optional)
export const useStoreActions = () => ({
  connection: useConnectionActions(),
  peers: usePeersActions(),
  media: useMediaActions(),
  chat: useChatActions(),
  ui: useUIActions()
});

// Import hooks for combined actions
import { useConnectionActions } from './connection-store';
import { usePeersActions } from './peers-store';
import { useMediaActions } from './media-store';
import { useChatActions } from './chat-store';
import { useUIActions } from './ui-store';