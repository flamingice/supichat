/**
 * Optimized VideoTile component with React.memo and minimal re-renders
 * Only re-renders when specific peer data changes
 */

'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { usePeer } from '@/lib/stores/room-store';

interface VideoTileProps {
  peerId: string;
  isLocal?: boolean;
  stream?: MediaStream | null;
  onToggleMute?: (peerId: string) => void;
  onTogglePin?: (peerId: string) => void;
  isPinned?: boolean;
  className?: string;
}

const VideoTile = React.memo(function VideoTile({ 
  peerId, 
  isLocal = false, 
  stream, 
  onToggleMute, 
  onTogglePin, 
  isPinned = false,
  className = '' 
}: VideoTileProps) {
  const peer = usePeer(peerId);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Imperatively attach media tracks to avoid React re-renders
  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement && stream && videoElement.srcObject !== stream) {
      videoElement.srcObject = stream;
    }
    
    return () => {
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [stream]);

  // Stable callback handlers
  const handleToggleMute = useCallback(() => {
    onToggleMute?.(peerId);
  }, [peerId, onToggleMute]);

  const handleTogglePin = useCallback(() => {
    onTogglePin?.(peerId);
  }, [peerId, onTogglePin]);

  const displayName = isLocal ? 'You' : (peer?.name || 'Guest');
  const isMuted = isLocal ? false : peer?.micEnabled === false;
  const isCameraOn = peer?.camEnabled !== false;
  const isSpeaking = peer?.speaking === true;
  const audioLevel = peer?.audioLevel || 0;

  return (
    <div className={`video-tile group ${isPinned ? 'pinned' : ''} ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Always mute local video to prevent feedback
        className="w-full h-full object-cover"
      />
      
      {!isCameraOn && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 6.5l-4 4V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11z"/>
              <path d="M2 2l20 20" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <p className="text-gray-400 text-sm">Camera off</p>
          </div>
        </div>
      )}

      <div className="video-overlay">
        {/* Name and language badge */}
        <div className="video-name">
          <span>{displayName}</span>
          {peer?.lang && (
            <span className="ml-1 text-xs bg-gray-600 px-1 rounded">
              {peer.lang.toUpperCase()}
            </span>
          )}
        </div>

        {/* Control buttons (visible on hover) */}
        {!isLocal && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            {onTogglePin && (
              <button 
                onClick={handleTogglePin}
                className={`rounded-full p-1 transition-colors ${
                  isPinned 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-black/70 hover:bg-black/90'
                }`}
                title={isPinned ? 'Unpin participant' : 'Pin participant'}
              >
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"/>
                </svg>
              </button>
            )}
            
            {onToggleMute && (
              <button 
                onClick={handleToggleMute}
                className={`rounded-full p-1 transition-colors ${
                  isMuted 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-black/70 hover:bg-black/90'
                }`}
                title={isMuted ? 'Unmute locally' : 'Mute locally'}
              >
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  {isMuted ? (
                    <path fillRule="evenodd" d="M2.22 2.22a.75.75 0 011.06 0L6.56 5.5H9a.75.75 0 010 1.5H8.06l3.94 3.94V14a.75.75 0 01-1.5 0v-2.44l-6.28-6.28a.75.75 0 010-1.06z" clipRule="evenodd"/>
                  ) : (
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                  )}
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Status indicators */}
        <div className="absolute top-2 right-2 flex gap-1">
          {isMuted && (
            <div className="bg-red-600 rounded-full p-1">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.22 2.22a.75.75 0 011.06 0L6.56 5.5H9a.75.75 0 010 1.5H8.06l3.94 3.94V14a.75.75 0 01-1.5 0v-2.44l-6.28-6.28a.75.75 0 010-1.06z" clipRule="evenodd"/>
              </svg>
            </div>
          )}
          
          {!isCameraOn && (
            <div className="bg-red-600 rounded-full p-1">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 4a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V4z"/>
                <path d="M2 2l16 16" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
          )}
        </div>

        {/* Audio level indicator */}
        {!isMuted && audioLevel > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/70 px-2 py-1 rounded">
            <div className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-green-500' : 'bg-gray-500'}`}></div>
            <div className="w-8 h-1 bg-gray-600 rounded-full overflow-hidden">
              <div 
                className={`h-1 transition-all ${isSpeaking ? 'bg-green-500' : 'bg-gray-400'}`}
                style={{ width: `${Math.min(100, Math.max(4, audioLevel))}%` }} 
              />
            </div>
          </div>
        )}

        {/* Speaking indicator */}
        {isSpeaking && (
          <div className="absolute inset-0 border-2 border-green-500 rounded pointer-events-none animate-pulse"></div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to minimize re-renders
  return (
    prevProps.peerId === nextProps.peerId &&
    prevProps.isLocal === nextProps.isLocal &&
    prevProps.stream === nextProps.stream &&
    prevProps.isPinned === nextProps.isPinned &&
    prevProps.className === nextProps.className
  );
});

export default VideoTile;