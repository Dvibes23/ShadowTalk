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
const messageMap = {}; // Store messages by ID

// Admin Panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Handle User Reports
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

  // Find random public room
  socket.on('findPublicRoom', (cb) => {
    const publicRoom = Object.entries(rooms).find(([name, info]) =>
      info.isPublic && info.users.length > 0
    );
    cb(publicRoom ? publicRoom[0] : null);
  });

  // Join Room
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
        reactions: []
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
      reactions: []
    };

    io.to(room).emit('message', joinMsg);
    io.to(room).emit('roomUsers', rooms[room].users);
  });

  // Handle Chat Message
  socket.on('chatMessage', (msgText) => {
    const id = 'msg-' + (msgCounter++);
    const fullMsg = {
      id,
      sender: socket.username,
      text: msgText,
      reactions: []
    };

    messageMap[id] = fullMsg;
    logs.push({ room: socket.room, msg: fullMsg });

    io.to(socket.room).emit('message', fullMsg);
  });

  // Handle Typing
  socket.on('typing', () => {
    socket.to(socket.room).emit('displayTyping', socket.username);
  });

  // Handle Voice Note
  socket.on('voiceMessage', (data) => {
    io.to(socket.room).emit('voiceNote', {
      sender: socket.username,
      audioData: data
    });
  });

  // Handle Emoji Reaction
  socket.on('addReaction', ({ msgId, emoji }) => {
    const message = messageMap[msgId];
    if (message) {
      message.reactions.push({ user: socket.username, emoji });
      io.to(socket.room).emit('reactionUpdate', {
        msgId,
        reactions: message.reactions
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const room = socket.room;
    if (room && rooms[room]) {
      rooms[room].users = rooms[room].users.filter(u => u.username !== socket.username);

      const leaveMsg = {
        id: 'msg-' + (msgCounter++),
        sender: 'System',
        text: `${socket.username} left the room.`,
        reactions: []
      };

      io.to(room).emit('message', leaveMsg);
      io.to(room).emit('roomUsers', rooms[room].users);

      if (rooms[room].users.length === 0) {
        delete rooms[room];
        delete kickedUsers[room];
      }
    }
  });

  // Admin Login
  socket.on('adminLogin', (password, cb) => {
    cb(password === adminPassword);
  });

  socket.on('getRooms', (cb) => {
    cb(Object.keys(rooms));
  });

  socket.on('getRoomUsers', (room, cb) => {
    cb(rooms[room]?.users.map(u => u.username) || []);
  });

  // Kick a user
  socket.on('kickUser', ({ room, user }) => {
    const exists = rooms[room]?.users.find(u => u.username === user);
    if (!exists) return;

    kickedUsers[room] = kickedUsers[room] || [];
    if (!kickedUsers[room].includes(user)) {
      kickedUsers[room].push(user);
    }

    const kickMsg = {
      id: 'msg-' + (msgCounter++),
      sender: 'System',
      text: `${user} was kicked by the support.`,
      reactions: []
    };

    logs.push({ room, msg: kickMsg });
    io.to(room).emit('message', kickMsg);

    for (let [id, s] of io.sockets.sockets) {
      if (s.username === user && s.room === room) {
        s.leave(room);
        s.emit('kicked', room);
      }
    }
  });

  // Mute a user
  socket.on('muteUser', ({ room, user }) => {
    const exists = rooms[room]?.users.find(u => u.username === user);
    if (!exists) return;

    const muteMsg = {
      id: 'msg-' + (msgCounter++),
      sender: 'System',
      text: `${user} was muted by the support.`,
      reactions: []
    };

    logs.push({ room, msg: muteMsg });
    io.to(room).emit('message', muteMsg);
  });

  // Get logs
  socket.on('getLogs', (room, cb) => {
    const roomLogs = logs.filter(log => log.room === room).map(l => l.msg);
    cb(roomLogs);
  });

  // Get Reports
  socket.on('getReports', (cb) => {
    cb([...reports]);
    reports.length = 0;
  });
});

// Start Server
server.listen(3000, () => {
  console.log('ShadowTalk 2050 server is live on port 3000');
});
