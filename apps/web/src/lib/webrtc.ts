export type Peer = {
  id: string;
  pc: RTCPeerConnection;
  stream: MediaStream;
};

export function createPeerConnection(iceServers: RTCIceServer[]): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers });
}

export async function addLocalTracks(pc: RTCPeerConnection, local: MediaStream) {
  local.getTracks().forEach(t => pc.addTrack(t, local));
}


