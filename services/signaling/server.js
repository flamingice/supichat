import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

const SIGNALING_PATH = process.env.NEXT_PUBLIC_SIGNALING_PATH || '/supichat/socket.io';
const io = new Server(httpServer, {
  path: SIGNALING_PATH,
  cors: {
    origin: true,
    credentials: true,
  }
});

io.on('connection', (socket) => {
  socket.on('join', ({ roomId, name, lang }) => {
    socket.data.name = name;
    socket.data.lang = lang;
    socket.join(roomId);

    // Send current roster to the joining client
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
      const peers = Array.from(room)
        .filter(id => id !== socket.id)
        .map(id => {
          const s = io.sockets.sockets.get(id);
          return {
            id,
            name: s?.data?.name,
            lang: s?.data?.lang,
            micEnabled: s?.data?.micEnabled,
            camEnabled: s?.data?.camEnabled,
          };
        });
      socket.emit('peers', peers);
    }

    // Notify others about the new peer
    socket.to(roomId).emit('peer-joined', { id: socket.id, name, lang });
  });

  socket.on('state', ({ roomId, micEnabled, camEnabled }) => {
    socket.data.micEnabled = micEnabled;
    socket.data.camEnabled = camEnabled;
    socket.to(roomId).emit('peer-state', { id: socket.id, micEnabled, camEnabled });
  });

  socket.on('signal', ({ roomId, targetId, data }) => {
    io.to(targetId).emit('signal', { from: socket.id, data });
  });

  socket.on('chat', ({ roomId, msg, lang }) => {
    socket.to(roomId).emit('chat', { from: socket.id, name: socket.data.name, msg, lang });
  });

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      socket.to(roomId).emit('peer-left', { id: socket.id });
    }
  });
});

/* HEALTH ENDPOINT APPEND START */
app.get('/health', (_, res) => {
  res.json({
    status: 'ok',
    service: 'signaling',
    timestamp: new Date().toISOString(),
    path: SIGNALING_PATH
  });
});
/* HEALTH ENDPOINT APPEND END */

const port = process.env.PORT || 4001;
httpServer.listen(port, () => console.log(`[signaling] listening on :${port} path ${SIGNALING_PATH}`));




