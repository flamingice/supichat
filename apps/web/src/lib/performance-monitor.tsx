/**
 * Performance monitoring utilities for tracking improvements
 * Measures render times, memory usage, and WebRTC stats
 */

import React from 'react';

interface PerformanceMetrics {
  renderCount: number;
  averageRenderTime: number;
  maxRenderTime: number;
  totalRenderTime: number;
  memoryUsage?: number;
  timestamp: number;
}

interface WebRTCStats {
  peerConnectionCount: number;
  activeStreams: number;
  packetLoss: number;
  roundTripTime: number;
  bitrateSent: number;
  bitrateReceived: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private observers: PerformanceObserver[] = [];
  private isMonitoring = false;

  start(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Monitor long tasks (main thread blocking)
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.duration > 50) { // > 50ms is considered long
              console.warn(`[PerfMonitor] Long task detected: ${entry.duration.toFixed(2)}ms`);
              this.recordMetric('longTasks', {
                renderCount: 1,
                averageRenderTime: entry.duration,
                maxRenderTime: entry.duration,
                totalRenderTime: entry.duration,
                timestamp: performance.now()
              });
            }
          });
        });
        
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);
      } catch (e) {
        console.warn('[PerfMonitor] Long task observer not supported');
      }

      // Monitor layout shifts
      try {
        const layoutShiftObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          let totalShift = 0;
          entries.forEach((entry: any) => {
            if (entry.value > 0.1) { // > 0.1 is poor CLS
              totalShift += entry.value;
            }
          });
          
          if (totalShift > 0) {
            console.warn(`[PerfMonitor] Layout shift detected: ${totalShift.toFixed(3)}`);
          }
        });
        
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(layoutShiftObserver);
      } catch (e) {
        console.warn('[PerfMonitor] Layout shift observer not supported');
      }
    }

    // Monitor memory usage periodically
    if ('memory' in performance) {
      this.startMemoryMonitoring();
    }
  }

  stop(): void {
    this.isMonitoring = false;
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }

  recordRender(componentName: string, renderTime: number): void {
    const existing = this.metrics.get(componentName) || {
      renderCount: 0,
      averageRenderTime: 0,
      maxRenderTime: 0,
      totalRenderTime: 0,
      timestamp: performance.now()
    };

    const newCount = existing.renderCount + 1;
    const newTotal = existing.totalRenderTime + renderTime;

    this.metrics.set(componentName, {
      renderCount: newCount,
      averageRenderTime: newTotal / newCount,
      maxRenderTime: Math.max(existing.maxRenderTime, renderTime),
      totalRenderTime: newTotal,
      timestamp: performance.now()
    });
  }

  recordMetric(name: string, metric: PerformanceMetrics): void {
    this.metrics.set(name, metric);
  }

  private startMemoryMonitoring(): void {
    const checkMemory = () => {
      if (!this.isMonitoring) return;
      
      const memory = (performance as any).memory;
      if (memory) {
        this.recordMetric('memory', {
          renderCount: 1,
          averageRenderTime: 0,
          maxRenderTime: 0,
          totalRenderTime: 0,
          memoryUsage: memory.usedJSHeapSize / 1024 / 1024, // MB
          timestamp: performance.now()
        });
      }
      
      setTimeout(checkMemory, 5000); // Check every 5 seconds
    };
    
    checkMemory();
  }

  async getWebRTCStats(peerConnections: RTCPeerConnection[]): Promise<WebRTCStats> {
    let totalPacketLoss = 0;
    let totalRtt = 0;
    let totalBitrateSent = 0;
    let totalBitrateReceived = 0;
    let validConnections = 0;

    for (const pc of peerConnections) {
      try {
        const stats = await pc.getStats();
        
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp') {
            totalPacketLoss += report.packetsLost || 0;
            totalBitrateReceived += report.bytesReceived || 0;
          } else if (report.type === 'outbound-rtp') {
            totalBitrateSent += report.bytesSent || 0;
          } else if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            totalRtt += report.currentRoundTripTime || 0;
            validConnections++;
          }
        });
      } catch (error) {
        console.warn('[PerfMonitor] Failed to get stats for peer connection:', error);
      }
    }

    return {
      peerConnectionCount: peerConnections.length,
      activeStreams: this.countActiveStreams(peerConnections),
      packetLoss: validConnections > 0 ? totalPacketLoss / validConnections : 0,
      roundTripTime: validConnections > 0 ? totalRtt / validConnections : 0,
      bitrateSent: totalBitrateSent,
      bitrateReceived: totalBitrateReceived
    };
  }

  private countActiveStreams(peerConnections: RTCPeerConnection[]): number {
    let streamCount = 0;
    peerConnections.forEach(pc => {
      const senders = pc.getSenders();
      const receivers = pc.getReceivers();
      streamCount += senders.filter(s => s.track).length;
      streamCount += receivers.filter(r => r.track).length;
    });
    return streamCount;
  }

  getMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }

  generateReport(): string {
    let report = '# Performance Report\n\n';
    
    this.metrics.forEach((metric, name) => {
      report += `## ${name}\n`;
      report += `- Render Count: ${metric.renderCount}\n`;
      report += `- Average Render Time: ${metric.averageRenderTime.toFixed(2)}ms\n`;
      report += `- Max Render Time: ${metric.maxRenderTime.toFixed(2)}ms\n`;
      report += `- Total Render Time: ${metric.totalRenderTime.toFixed(2)}ms\n`;
      
      if (metric.memoryUsage) {
        report += `- Memory Usage: ${metric.memoryUsage.toFixed(2)}MB\n`;
      }
      
      report += '\n';
    });

    return report;
  }

  clear(): void {
    this.metrics.clear();
  }
}

// React hook for component performance tracking
export function usePerformanceTracker(componentName: string) {
  const monitor = getPerformanceMonitor();
  
  const trackRender = React.useCallback((renderTime: number) => {
    monitor.recordRender(componentName, renderTime);
  }, [componentName, monitor]);

  const withPerformanceTracking = React.useCallback(<T extends any[]>(
    fn: (...args: T) => any
  ) => {
    return (...args: T) => {
      const start = performance.now();
      const result = fn(...args);
      const end = performance.now();
      trackRender(end - start);
      return result;
    };
  }, [trackRender]);

  return { trackRender, withPerformanceTracking };
}

// HOC for automatic performance tracking
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  const WrappedComponent = React.memo((props: P) => {
    const start = performance.now();
    
    React.useEffect(() => {
      const end = performance.now();
      getPerformanceMonitor().recordRender(componentName, end - start);
    });

    return <Component {...props} />;
  });
  
  return WrappedComponent;
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }
  return performanceMonitor;
}

// Auto-start in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  getPerformanceMonitor().start();
}

export default PerformanceMonitor;