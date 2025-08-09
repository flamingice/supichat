import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

const SIGNALING_PATH = process.env.NEXT_PUBLIC_SIGNALING_PATH || '/MyChatApp/socket.io';
const io = new Server(httpServer, {
  path: SIGNALING_PATH,
  cors: {
    origin: true,
    credentials: true,
  }
});

io.on('connection', (socket) => {
  socket.on('join', ({ roomId, name }) => {
    socket.data.name = name;
    socket.join(roomId);
    socket.to(roomId).emit('peer-joined', { id: socket.id, name });
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


