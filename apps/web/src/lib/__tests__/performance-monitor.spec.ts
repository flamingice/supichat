import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PerformanceMonitor, { getPerformanceMonitor } from '../performance-monitor.tsx';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = getPerformanceMonitor();
    monitor.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Stop any monitoring loops
    monitor.stop();
    vi.useRealTimers();
  });

  it('aggregates render metrics and generates report', () => {
    // Lines 95-114: recordRender aggregation; 194-212: generateReport
    monitor.recordRender('Comp', 10);
    monitor.recordRender('Comp', 30);

    const metrics = monitor.getMetrics().get('Comp')!;
    expect(metrics.renderCount).toBe(2);
    expect(metrics.averageRenderTime).toBeCloseTo(20, 1);
    expect(metrics.maxRenderTime).toBe(30);
    const report = monitor.generateReport();
    expect(report).toContain('## Comp');
    expect(report).toContain('Average Render Time: 20.00ms');
  });

  it('collects WebRTC stats and handles getStats failures', async () => {
    // Lines 142-176: stat collection and error handling; 179-188: active streams
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const okPc: any = {
      getStats: async () => ({
        forEach: (cb: any) => {
          cb({ type: 'inbound-rtp', packetsLost: 4, bytesReceived: 2000 });
          cb({ type: 'outbound-rtp', bytesSent: 1000 });
          cb({ type: 'candidate-pair', state: 'succeeded', currentRoundTripTime: 0.3 });
        },
      }),
      getSenders: () => [{ track: {} }, { track: null }],
      getReceivers: () => [{ track: {} }],
    };

    const badPc: any = {
      getStats: async () => { throw new Error('no stats'); },
      getSenders: () => [],
      getReceivers: () => [],
    };

    const res = await monitor.getWebRTCStats([okPc as RTCPeerConnection, badPc as RTCPeerConnection]);
    expect(res.peerConnectionCount).toBe(2);
    expect(res.activeStreams).toBe(2); // 1 sender with track + 1 receiver with track
    expect(res.packetLoss).toBeCloseTo(4); // divided by validConnections (1)
    expect(res.roundTripTime).toBeCloseTo(0.3);
    expect(res.bitrateSent).toBe(1000);
    expect(res.bitrateReceived).toBe(2000);
    expect(warn).toHaveBeenCalled();
  });

  it.skip('starts memory monitoring when performance.memory exists (requires DOM)', () => {
    // Skipped - requires DOM environment for React and performance.memory
  });

  it.skip('stops memory monitoring after stop() (requires DOM)', () => {
    // Skipped - requires DOM environment for React and performance.memory
  });
});