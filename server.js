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

// Admin Panel Route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Handle Report from Users
app.post('/report', (req, res) => {
  const { report } = req.body;
  if (!report) return res.status(400).json({ error: 'Empty report' });

  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${report}`;
  reports.push(entry);
  fs.appendFileSync('reports.log', entry + '\n');

  res.json({ success: true });
});

io.on('connection', (socket) => {
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

  // Text Message
  socket.on('chatMessage', (msg) => {
    const fullMsg = `${socket.username}: ${msg}`;
    logs.push({ room: socket.room, msg: fullMsg });
    io.to(socket.room).emit('message', fullMsg);
  });

  // Typing Notification
  socket.on('typing', () => {
    socket.to(socket.room).emit('displayTyping', socket.username);
  });

  // Voice Message
  socket.on('voiceMessage', (data) => {
    io.to(socket.room).emit('voiceNote', {
      sender: socket.username,
      audioData: data
    });
  });

  // Handle Disconnect
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

  // ADMIN SOCKET EVENTS

  // Admin Login
  socket.on('adminLogin', (password, cb) => {
    cb(password === adminPassword);
  });

  // Get Active Rooms
  socket.on('getRooms', (cb) => {
    cb(Object.keys(rooms));
  });

  // Get Users in Room
  socket.on('getRoomUsers', (room, cb) => {
    cb(rooms[room]?.users.map(u => u.username) || []);
  });

  // Kick User
  socket.on('kickUser', ({ room, user }) => {
    kickedUsers[room] = kickedUsers[room] || [];
    if (!kickedUsers[room].includes(user)) {
      kickedUsers[room].push(user);
    }

    logs.push({ room, msg: `${user} was kicked by admin.` });
    io.to(room).emit('message', `${user} was kicked by admin.`);

    for (let [id, s] of io.sockets.sockets) {
      if (s.username === user && s.room === room) {
        s.leave(room);
        s.emit('kicked', room);
      }
    }
  });

  // Mute User
  socket.on('muteUser', ({ room, user }) => {
    logs.push({ room, msg: `${user} was muted by admin.` });
    io.to(room).emit('message', `${user} was muted by admin.`);
  });

  // Get Logs for Room
  socket.on('getLogs', (room, cb) => {
    const roomLogs = logs.filter(log => log.room === room).map(l => l.msg);
    cb(roomLogs);
  });

  // Get & Clear Reports
  socket.on('getReports', (cb) => {
    cb([...reports]);
    reports.length = 0; // Clear reports after viewing
  });
});

server.listen(3000, () => {
  console.log('ShadowTalk 2050 server is live on port 3000');
});
