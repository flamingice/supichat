import { describe, it, expect, beforeEach } from 'vitest';
import { useRoomStore } from '../../stores/room-store';

function resetStore() {
  const initial = useRoomStore.getState();
  // Deep clone initial to avoid shared references
  const snapshot = JSON.parse(JSON.stringify(initial));
  useRoomStore.setState(snapshot, true);
}

describe('Room store actions', () => {
  beforeEach(() => {
    resetStore();
  });

  it('joinRoom sets connection and user; leaveRoom resets slices', () => {
    const { actions } = useRoomStore.getState();
    actions.joinRoom('room1', 'Alice', 'de');

    let s = useRoomStore.getState();
    expect(s.connection.joined).toBe(true);
    expect(s.connection.roomId).toBe('room1');
    expect(s.ui.user.name).toBe('Alice');
    expect(s.ui.user.lang).toBe('de');

    actions.leaveRoom();
    s = useRoomStore.getState();
    expect(s.connection.joined).toBe(false);
    expect(s.connection.roomId).toBeNull();
    expect(s.peers.peerOrder).toEqual([]);
    expect(s.chat.messageIds).toEqual([]);
    expect(s.connection.status).toBe('connecting');
  });

  it('upsertPeer/add/remove respects order and clears pin when removed', () => {
    const { actions } = useRoomStore.getState();
    actions.upsertPeer({ id: 'p1', name: 'A' });
    actions.upsertPeer({ id: 'p2', name: 'B' });
    actions.setPinnedPeer('p1');
    actions.removePeer('p1');

    const s = useRoomStore.getState();
    expect(s.peers.peerOrder).toEqual(['p2']);
    expect(s.peers.peerMap['p1']).toBeUndefined();
    expect(s.peers.pinnedPeerId).toBeNull();
  });

  it('setPeerSpeaking is a no-op when value unchanged', () => {
    const { actions } = useRoomStore.getState();
    actions.upsertPeer({ id: 'p3', speaking: true });
    const before = useRoomStore.getState().peers.peerMap['p3'];
    actions.setPeerSpeaking('p3', true); // Lines 229-241: no-op when equal
    const after = useRoomStore.getState().peers.peerMap['p3'];
    expect(after).toEqual(before); // no mutation
  });

  it('setPeerAudioLevel only updates when change >= 0.05', () => {
    const { actions } = useRoomStore.getState();
    actions.upsertPeer({ id: 'p4', audioLevel: 0.1 });
    actions.setPeerAudioLevel('p4', 0.12); // delta 0.02 -> no-op
    let s = useRoomStore.getState();
    expect(s.peers.peerMap['p4'].audioLevel).toBe(0.1);

    actions.setPeerAudioLevel('p4', 0.2); // delta 0.1 -> update
    s = useRoomStore.getState();
    expect(s.peers.peerMap['p4'].audioLevel).toBe(0.2);
  });

  it('addMessage increments unread when sidebar tab is not chat', () => {
    const { actions } = useRoomStore.getState();
    actions.setSidebarTab('people'); // Lines 344-349
    actions.addMessage({ id: 'm1', original: 'hi', from: 'p1', name: 'A' }); // Lines 303-310
    let s = useRoomStore.getState();
    expect(s.chat.unreadCount).toBe(1);

    // On chat tab, does not increment
    actions.setSidebarTab('chat');
    actions.addMessage({ id: 'm2', original: 'there' });
    s = useRoomStore.getState();
    expect(s.chat.unreadCount).toBe(1);
    expect(s.chat.messageIds).toEqual(['m1', 'm2']);
  });

  it('updateMessageTranslation is no-op when message id not found', () => {
    const { actions } = useRoomStore.getState();
    const before = useRoomStore.getState().chat.messagesById;
    actions.updateMessageTranslation('missing', 'translated'); // Lines 313-326
    const after = useRoomStore.getState().chat.messagesById;
    expect(after).toEqual(before);
  });

  it('toggleMic/toggleCam flip booleans', () => {
    const { actions } = useRoomStore.getState();
    const before = useRoomStore.getState().media.local;
    actions.toggleMic();
    actions.toggleCam();
    const after = useRoomStore.getState().media.local;
    expect(after.micEnabled).toBe(!before.micEnabled);
    expect(after.camEnabled).toBe(!before.camEnabled);
  });

  it('setPeerState with non-existent peer is no-op', () => {
    const { actions } = useRoomStore.getState();
    const before = useRoomStore.getState().peers.peerMap;
    actions.setPeerState('nonexistent', { name: 'Ghost' });
    const after = useRoomStore.getState().peers.peerMap;
    expect(after).toEqual(before);
  });

  it('clearUnreadCount sets counter to zero', () => {
    const { actions } = useRoomStore.getState();
    actions.setSidebarTab('people');
    actions.addMessage({ id: 'm1', original: 'test' });
    expect(useRoomStore.getState().chat.unreadCount).toBe(1);
    
    actions.clearUnreadCount();
    expect(useRoomStore.getState().chat.unreadCount).toBe(0);
  });

  it('setDevices and setLocalMediaState merge semantics', () => {
    const { actions } = useRoomStore.getState();
    
    // Test setDevices merging
    actions.setDevices({ mics: [{ deviceId: 'mic1' } as MediaDeviceInfo] });
    let s = useRoomStore.getState();
    expect(s.media.devices.mics).toHaveLength(1);
    expect(s.media.devices.cams).toEqual([]); // preserved
    
    // Test setLocalMediaState merging
    actions.setLocalMediaState({ micEnabled: false });
    s = useRoomStore.getState();
    expect(s.media.local.micEnabled).toBe(false);
    expect(s.media.local.camEnabled).toBe(true); // preserved
  });
});