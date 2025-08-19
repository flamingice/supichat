/**
 * Optimized audio level throttling system
 * Coalesces high-frequency audio updates to 10-15Hz while maintaining smooth UI
 */

import React from 'react';

interface AudioLevelData {
  peak: number;
  lastUpdated: number;
  speaking: boolean;
}

interface ThrottleConfig {
  updateInterval: number; // ms between store updates
  speakingThreshold: number; // audio level to trigger speaking
  silenceThreshold: number; // audio level to stop speaking
  speakingHoldTime: number; // ms to hold speaking state
}

class AudioLevelThrottler {
  private levelMap = new Map<string, AudioLevelData>();
  private lastFlush = 0;
  private config: ThrottleConfig;
  private flushInterval: number;
  private onUpdate: (updates: Array<{ peerId: string; audioLevel: number; speaking: boolean }>) => void;

  constructor(
    onUpdate: (updates: Array<{ peerId: string; audioLevel: number; speaking: boolean }>) => void,
    config: Partial<ThrottleConfig> = {}
  ) {
    this.onUpdate = onUpdate;
    this.config = {
      updateInterval: 66, // ~15Hz
      speakingThreshold: 0.2,
      silenceThreshold: 0.12,
      speakingHoldTime: 300, // 300ms hold
      ...config
    };

    // Start the flush interval
    this.flushInterval = window.setInterval(() => {
      this.flush();
    }, this.config.updateInterval);
  }

  updateLevel(peerId: string, rawLevel: number): void {
    const now = performance.now();
    const existing = this.levelMap.get(peerId);
    
    // Calculate speaking state with hysteresis
    let speaking = existing?.speaking ?? false;
    if (rawLevel > this.config.speakingThreshold) {
      speaking = true;
    } else if (rawLevel < this.config.silenceThreshold) {
      // Only stop speaking if we've been below threshold for hold time
      if (existing && (now - existing.lastUpdated) > this.config.speakingHoldTime) {
        speaking = false;
      }
    }
    // Otherwise maintain current speaking state (hysteresis)

    this.levelMap.set(peerId, {
      peak: rawLevel,
      lastUpdated: now,
      speaking
    });
  }

  private flush(): void {
    const now = performance.now();
    if (now - this.lastFlush < this.config.updateInterval) return;
    
    this.lastFlush = now;
    const updates: Array<{ peerId: string; audioLevel: number; speaking: boolean }> = [];

    this.levelMap.forEach((data, peerId) => {
      // Only include in updates if level changed significantly or speaking state changed
      updates.push({
        peerId,
        audioLevel: data.peak,
        speaking: data.speaking
      });
    });

    if (updates.length > 0) {
      // Use startTransition for non-blocking updates
      if (typeof window !== 'undefined' && 'React' in window && (window as any).React.startTransition) {
        (window as any).React.startTransition(() => {
          this.onUpdate(updates);
        });
      } else {
        // Fallback for when React.startTransition is not available
        requestAnimationFrame(() => {
          this.onUpdate(updates);
        });
      }
    }
  }

  removePeer(peerId: string): void {
    this.levelMap.delete(peerId);
  }

  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.levelMap.clear();
  }

  getStats() {
    return {
      activePeers: this.levelMap.size,
      config: this.config,
      lastFlush: this.lastFlush
    };
  }
}

/**
 * Audio analyzer for Web Audio API integration
 */
export class AudioAnalyzer {
  private audioContext?: AudioContext;
  private analyserNodes = new Map<string, AnalyserNode>();
  private animationFrame?: number;
  private throttler: AudioLevelThrottler;
  private isRunning = false;

  constructor(onUpdate: (updates: Array<{ peerId: string; audioLevel: number; speaking: boolean }>) => void) {
    this.throttler = new AudioLevelThrottler(onUpdate);
  }

  async initializeForStream(peerId: string, stream: MediaStream): Promise<void> {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Resume context if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      
      this.analyserNodes.set(peerId, analyser);

      // Start analysis loop if not already running
      if (!this.isRunning) {
        this.startAnalysis();
      }
    } catch (error) {
      console.warn(`[AudioAnalyzer] Failed to initialize for peer ${peerId}:`, error);
    }
  }

  private startAnalysis(): void {
    this.isRunning = true;
    
    const analyze = () => {
      if (!this.isRunning) return;

      this.analyserNodes.forEach((analyser, peerId) => {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Calculate RMS (root mean square) for more accurate volume detection
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        const normalizedLevel = rms / 255; // Normalize to 0-1

        this.throttler.updateLevel(peerId, normalizedLevel);
      });

      this.animationFrame = requestAnimationFrame(analyze);
    };

    analyze();
  }

  removeStream(peerId: string): void {
    this.analyserNodes.delete(peerId);
    this.throttler.removePeer(peerId);
    
    // Stop analysis if no more streams
    if (this.analyserNodes.size === 0) {
      this.stopAnalysis();
    }
  }

  private stopAnalysis(): void {
    this.isRunning = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = undefined;
    }
  }

  destroy(): void {
    this.stopAnalysis();
    this.throttler.destroy();
    this.analyserNodes.clear();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }

  getStats() {
    return {
      activeStreams: this.analyserNodes.size,
      isRunning: this.isRunning,
      contextState: this.audioContext?.state,
      throttlerStats: this.throttler.getStats()
    };
  }
}

// Hook for using audio analysis in React components
export function useAudioAnalyzer() {
  const [analyzer, setAnalyzer] = React.useState<AudioAnalyzer | null>(null);
  
  const initializeAnalyzer = React.useCallback((
    onUpdate: (updates: Array<{ peerId: string; audioLevel: number; speaking: boolean }>) => void
  ) => {
    const newAnalyzer = new AudioAnalyzer(onUpdate);
    setAnalyzer(newAnalyzer);
    return newAnalyzer;
  }, []);

  React.useEffect(() => {
    return () => {
      analyzer?.destroy();
    };
  }, [analyzer]);

  return { analyzer, initializeAnalyzer };
}

export default AudioLevelThrottler;