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

// Admin panel route
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

// Socket handling
io.on('connection', (socket) => {

  // Return a public room with users for random join
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

    // Create room if it doesn’t exist
    if (!rooms[room]) {
      rooms[room] = {
        users: [],
        password: password || '',
        isPublic: isPublic || false
      };
    }

    if (rooms[room].password && rooms[room].password !== password) {
      socket.emit('message', 'Incorrect room password.');
      return;
    }

    socket.username = username;
    socket.room = room;
    socket.join(room);

    rooms[room].users.push({ username });

    io.to(room).emit('message', `${username} joined the room.`);
    io.to(room).emit('roomUsers', rooms[room].users);
  });

  // Chat message
  socket.on('chatMessage', (msg) => {
    const fullMsg = `${socket.username}: ${msg}`;
    logs.push({ room: socket.room, msg: fullMsg });
    io.to(socket.room).emit('message', fullMsg);
  });

  // Typing indicator
  socket.on('typing', () => {
    socket.to(socket.room).emit('displayTyping', socket.username);
  });

  // Voice message
  socket.on('voiceMessage', (data) => {
    io.to(socket.room).emit('voiceNote', {
      sender: socket.username,
      audioData: data
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const room = socket.room;
    if (room && rooms[room]) {
      rooms[room].users = rooms[room].users.filter(u => u.username !== socket.username);
      io.to(room).emit('message', `${socket.username} left the room.`);
      io.to(room).emit('roomUsers', rooms[room].users);

      if (rooms[room].users.length === 0) {
        delete rooms[room];
        delete kickedUsers[room];
      }
    }
  });

  // Admin login
  socket.on('adminLogin', (password, cb) => {
    cb(password === adminPassword);
  });

  // Get all active rooms
  socket.on('getRooms', (cb) => {
    cb(Object.keys(rooms));
  });

  // Get users in a room
  socket.on('getRoomUsers', (room, cb) => {
    cb(rooms[room]?.users.map(u => u.username) || []);
  });

  // Kick a user
  socket.on('kickUser', ({ room, user }) => {
    const roomUsers = rooms[room]?.users || [];
    const exists = roomUsers.find(u => u.username === user);

    if (!exists) return; // prevent kicking non-existent users

    kickedUsers[room] = kickedUsers[room] || [];
    if (!kickedUsers[room].includes(user)) {
      kickedUsers[room].push(user);
    }

    logs.push({ room, msg: `${user} was kicked by the support.` });
    io.to(room).emit('message', `${user} was kicked by the support.`);

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
    if (!exists) return; // skip if user is not in the room

    logs.push({ room, msg: `${user} was muted by the support.` });
    io.to(room).emit('message', `${user} was muted by the support.`);
  });

  // Get chat logs
  socket.on('getLogs', (room, cb) => {
    const roomLogs = logs.filter(log => log.room === room).map(l => l.msg);
    cb(roomLogs);
  });

  // Get and clear reports
  socket.on('getReports', (cb) => {
    cb([...reports]);
    reports.length = 0;
  });
});

// Server start
server.listen(3000, () => {
  console.log('ShadowTalk 2050 server is live on port 3000');
});
