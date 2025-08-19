import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPeerConnection, addLocalTracks } from '../webrtc';

// Mock RTCPeerConnection for testing
const mockPeerConnection = {
  addTrack: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

global.RTCPeerConnection = vi.fn(() => mockPeerConnection) as any;

describe('WebRTC utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('createPeerConnection initializes with ICE servers', () => {
    const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
    const pc = createPeerConnection(iceServers);
    
    expect(RTCPeerConnection).toHaveBeenCalledWith({ iceServers });
    expect(pc).toBe(mockPeerConnection);
  });

  it('addLocalTracks adds all tracks from stream to peer connection', async () => {
    const mockTrack1 = { id: 'track1', kind: 'audio' };
    const mockTrack2 = { id: 'track2', kind: 'video' };
    const mockStream = {
      getTracks: vi.fn(() => [mockTrack1, mockTrack2]),
    } as any;

    await addLocalTracks(mockPeerConnection as any, mockStream);

    expect(mockStream.getTracks).toHaveBeenCalled();
    expect(mockPeerConnection.addTrack).toHaveBeenCalledTimes(2);
    expect(mockPeerConnection.addTrack).toHaveBeenCalledWith(mockTrack1, mockStream);
    expect(mockPeerConnection.addTrack).toHaveBeenCalledWith(mockTrack2, mockStream);
  });

  it('addLocalTracks handles empty stream gracefully', async () => {
    const mockStream = {
      getTracks: vi.fn(() => []),
    } as any;

    await addLocalTracks(mockPeerConnection as any, mockStream);

    expect(mockStream.getTracks).toHaveBeenCalled();
    expect(mockPeerConnection.addTrack).not.toHaveBeenCalled();
  });
});