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

// Admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.post('/report', (req, res) => {
  const { report } = req.body;
  if (!report) return res.status(400).json({ error: 'Empty report' });

  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${report}`;
  reports.push(entry);
  fs.appendFileSync('reports.log', entry + '\n');

  res.json({ success: true });
});

let msgCounter = 1;

io.on('connection', (socket) => {
  // Find a random public room
  socket.on('findPublicRoom', (cb) => {
    const publicRoom = Object.entries(rooms).find(([name, info]) =>
      info.isPublic && info.users.length > 0
    );
    cb(publicRoom ? publicRoom[0] : null);
  });

  // Join room
  socket.on('joinRoom', ({ username, room, password, isPublic }) => {
    if (kickedUsers[room]?.includes(username)) {
      socket.emit('kicked', room);
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
        id: 'sys-' + Date.now(),
        sender: 'System',
        text: 'Incorrect room password.',
      });
      return;
    }

    socket.username = username;
    socket.room = room;
    socket.join(room);

    rooms[room].users.push({ username });

    const joinMsg = {
      id: 'msg-' + (msgCounter++),
      sender: 'System',
      text: `${username} joined the room.`,
    };

    io.to(room).emit('message', joinMsg);
    io.to(room).emit('roomUsers', rooms[room].users);
  });

  // Chat message
  socket.on('chatMessage', (text) => {
    const message = {
      id: 'msg-' + (msgCounter++),
      sender: socket.username,
      text,
    };
    logs.push({ room: socket.room, msg: message });
    io.to(socket.room).emit('message', message);
  });

  // Typing
  socket.on('typing', () => {
    socket.to(socket.room).emit('displayTyping', socket.username);
  });

  // Voice
  socket.on('voiceMessage', (data) => {
    io.to(socket.room).emit('voiceNote', {
      sender: socket.username,
      audioData: data
    });
  });

  // Reaction to message
  socket.on('addReaction', ({ msgId, emoji }) => {
    io.to(socket.room).emit('messageReaction', {
      msgId,
      emoji,
      reactor: socket.username
    });
  });

  // Call initiation
  socket.on('startCall', () => {
    socket.to(socket.room).emit('incomingCall', socket.username);
  });

  // Call accept
  socket.on('acceptCall', () => {
    socket.to(socket.room).emit('callAccepted');
  });

  // End call
  socket.on('endCall', () => {
    io.to(socket.room).emit('callEnded');
  });

  // Disconnect
  socket.on('disconnect', () => {
    const room = socket.room;
    if (room && rooms[room]) {
      rooms[room].users = rooms[room].users.filter(u => u.username !== socket.username);
      io.to(room).emit('message', {
        id: 'msg-' + (msgCounter++),
        sender: 'System',
        text: `${socket.username} left the room.`
      });
      io.to(room).emit('roomUsers', rooms[room].users);

      if (rooms[room].users.length === 0) {
        delete rooms[room];
        delete kickedUsers[room];
      }
    }
  });

  // Admin tools
  socket.on('adminLogin', (password, cb) => {
    cb(password === adminPassword);
  });

  socket.on('getRooms', (cb) => {
    cb(Object.keys(rooms));
  });

  socket.on('getRoomUsers', (room, cb) => {
    cb((rooms[room]?.users || []).map(u => u.username));
  });

  socket.on('kickUser', ({ room, user }) => {
    const users = rooms[room]?.users || [];
    const exists = users.find(u => u.username === user);
    if (!exists) return;

    kickedUsers[room] = kickedUsers[room] || [];
    if (!kickedUsers[room].includes(user)) {
      kickedUsers[room].push(user);
    }

    logs.push({ room, msg: `${user} was kicked by support.` });
    io.to(room).emit('message', {
      id: 'msg-' + (msgCounter++),
      sender: 'System',
      text: `${user} was kicked by the support.`
    });

    for (let [id, s] of io.sockets.sockets) {
      if (s.username === user && s.room === room) {
        s.leave(room);
        s.emit('kicked', room);
      }
    }
  });

  socket.on('muteUser', ({ room, user }) => {
    const exists = rooms[room]?.users.find(u => u.username === user);
    if (!exists) return;

    logs.push({ room, msg: `${user} was muted.` });
    io.to(room).emit('message', {
      id: 'msg-' + (msgCounter++),
      sender: 'System',
      text: `${user} was muted by the support.`
    });
  });

  socket.on('getLogs', (room, cb) => {
    const roomLogs = logs
      .filter(log => log.room === room)
      .map(l => `${l.msg.sender}: ${l.msg.text}`);
    cb(roomLogs);
  });

  socket.on('getReports', (cb) => {
    cb([...reports]);
    reports.length = 0;
  });
});

// Start server
server.listen(3000, () => {
  console.log('ShadowTalk 2050 server is live on port 3000');
});
