const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));
app.use(express.json());

const rooms = {};
const logs = [];
const reports = [];
const kickedUsers = {};
const adminPassword = 'AdUnNi';
let msgCounter = 1;

// Admin Panel Route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Handle user reports
app.post('/report', (req, res) => {
  const { report } = req.body;
  if (!report) return res.status(400).json({ error: 'Empty report' });

  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${report}`;
  reports.push(entry);
  fs.appendFileSync('reports.log', entry + '\n');

  res.json({ success: true });
});

// Socket Handling
io.on('connection', (socket) => {
  // Find Public Room
  socket.on('findPublicRoom', (cb) => {
    const publicRoom = Object.entries(rooms).find(([name, info]) =>
      info.isPublic && info.users.length > 0
    );
    cb(publicRoom ? publicRoom[0] : null);
  });

  // Join Room
  socket.on('joinRoom', ({ username, room, password, isPublic }) => {
    if (kickedUsers[room]?.includes(username)) {
      socket.emit('kicked');
      return;
    }

    if (!rooms[room]) {
      rooms[room] = {
        users: [],
        password: password || '',
        isPublic: isPublic || false
      };
    }

    if (rooms[room].password && rooms[room].password !== password) {
      socket.emit('message', {
        id: 'sys-' + msgCounter++,
        username: 'System',
        text: 'Incorrect room password.',
        reaction: ''
      });
      return;
    }

    socket.username = username;
    socket.room = room;
    socket.join(room);

    rooms[room].users.push({ username });

    const joinMsg = {
      id: 'msg-' + msgCounter++,
      username: 'System',
      text: `${username} joined the room.`,
      reaction: ''
    };
    logs.push({ room, msg: joinMsg });

    io.to(room).emit('message', joinMsg);
    io.to(room).emit('roomUsers', rooms[room].users);
  });

  // Chat Message
  socket.on('chatMessage', (text) => {
    const newMsg = {
      id: 'msg-' + msgCounter++,
      username: socket.username,
      text,
      reaction: ''
    };
    logs.push({ room: socket.room, msg: newMsg });
    io.to(socket.room).emit('message', newMsg);
  });

  // Add Reaction
  socket.on('addReaction', ({ msgId, emoji }) => {
    const room = socket.room;
    const msg = logs.find(log => log.room === room && log.msg.id === msgId);
    if (msg) {
      msg.msg.reaction = emoji;
      io.to(room).emit('message', msg.msg);
    }
  });

  // Typing
  socket.on('typing', () => {
    socket.to(socket.room).emit('displayTyping', socket.username);
  });

  // Voice Note
  socket.on('voiceMessage', (data) => {
    io.to(socket.room).emit('voiceNote', {
      sender: socket.username,
      audioData: data
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const room = socket.room;
    if (room && rooms[room]) {
      rooms[room].users = rooms[room].users.filter(u => u.username !== socket.username);

      const leaveMsg = {
        id: 'msg-' + msgCounter++,
        username: 'System',
        text: `${socket.username} left the room.`,
        reaction: ''
      };
      logs.push({ room, msg: leaveMsg });

      io.to(room).emit('message', leaveMsg);
      io.to(room).emit('roomUsers', rooms[room].users);

      if (rooms[room].users.length === 0) {
        delete rooms[room];
        delete kickedUsers[room];
      }
    }
  });

  // Admin Functions
  socket.on('adminLogin', (password, cb) => cb(password === adminPassword));
  socket.on('getRooms', (cb) => cb(Object.keys(rooms)));
  socket.on('getRoomUsers', (room, cb) => cb(rooms[room]?.users.map(u => u.username) || []));
  socket.on('kickUser', ({ room, user }) => {
    const exists = rooms[room]?.users.find(u => u.username === user);
    if (!exists) return;

    kickedUsers[room] = kickedUsers[room] || [];
    if (!kickedUsers[room].includes(user)) kickedUsers[room].push(user);

    const kickMsg = {
      id: 'msg-' + msgCounter++,
      username: 'System',
      text: `${user} was kicked by the support.`,
      reaction: ''
    };
    logs.push({ room, msg: kickMsg });

    io.to(room).emit('message', kickMsg);

    for (let [id, s] of io.sockets.sockets) {
      if (s.username === user && s.room === room) {
        s.leave(room);
        s.emit('kicked');
      }
    }
  });

  socket.on('muteUser', ({ room, user }) => {
    const exists = rooms[room]?.users.find(u => u.username === user);
    if (!exists) return;

    const muteMsg = {
      id: 'msg-' + msgCounter++,
      username: 'System',
      text: `${user} was muted by the support.`,
      reaction: ''
    };
    logs.push({ room, msg: muteMsg });
    io.to(room).emit('message', muteMsg);
  });

  // Logs
  socket.on('getLogs', (room, cb) => {
    const roomLogs = logs.filter(log => log.room === room).map(l => l.msg);
    cb(roomLogs);
  });

  socket.on('getReports', (cb) => {
    cb([...reports]);
    reports.length = 0;
  });
});

// Start Server
server.listen(3000, () => {
  console.log('ShadowTalk 2050 server is live on port 3000');
});
