/**
 * Optimized VideoGrid component with minimal re-renders
 * Only renders when peer order changes, not when individual peer data changes
 */

'use client';

import React, { useMemo } from 'react';
import { usePeerIds, usePeer, useLocalMedia, useActions } from '@/lib/stores/room-store';
import VideoTile from './VideoTile';

interface VideoGridProps {
  localStream?: MediaStream | null;
  getRemoteStream?: (peerId: string) => MediaStream | null;
  className?: string;
}

const VideoGrid = React.memo(function VideoGrid({ 
  localStream, 
  getRemoteStream,
  className = '' 
}: VideoGridProps) {
  const peerIds = usePeerIds();
  const localMedia = useLocalMedia();
  const actions = useActions();
  
  // Stable grid layout calculation
  const gridLayout = useMemo(() => {
    const totalParticipants = 1 + peerIds.length; // +1 for local user
    
    // Calculate optimal grid dimensions
    const cols = Math.ceil(Math.sqrt(totalParticipants));
    const rows = Math.ceil(totalParticipants / cols);
    
    return {
      cols,
      rows,
      totalParticipants,
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gridTemplateRows: `repeat(${rows}, 1fr)`
    };
  }, [peerIds.length]);

  // Memoized handlers to prevent VideoTile re-renders
  const handleTogglePeerMute = useMemo(() => (peerId: string) => {
    // This would integrate with your local muting logic
    console.log(`Toggle mute for peer: ${peerId}`);
  }, []);

  const handleTogglePeerPin = useMemo(() => (peerId: string) => {
    actions.setPinnedPeer(peerId);
  }, [actions]);

  const pinnedPeerId = usePeer('pinned')?.id; // You'd need to implement this in the store

  return (
    <div 
      className={`video-grid h-full ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: gridLayout.gridTemplateColumns,
        gridTemplateRows: gridLayout.gridTemplateRows,
        gap: '4px',
        padding: '4px'
      }}
    >
      {/* Local video tile */}
      <VideoTile
        peerId="local"
        isLocal={true}
        stream={localStream}
        className="local-video"
      />

      {/* Remote video tiles */}
      {peerIds.map(peerId => (
        <VideoTile
          key={peerId}
          peerId={peerId}
          isLocal={false}
          stream={getRemoteStream?.(peerId)}
          onToggleMute={handleTogglePeerMute}
          onTogglePin={handleTogglePeerPin}
          isPinned={pinnedPeerId === peerId}
          className="remote-video"
        />
      ))}
    </div>
  );
});

export default VideoGrid;