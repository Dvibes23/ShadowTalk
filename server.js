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
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// Handle report POST from frontend
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

  socket.on('chatMessage', (msg) => {
    const room = socket.room;
    const fullMsg = `${socket.username}: ${msg}`;
    logs.push({ room, msg: fullMsg });
    io.to(room).emit('message', fullMsg);
  });

  socket.on('typing', () => {
    socket.to(socket.room).emit('displayTyping', socket.username);
  });

  socket.on('voiceMessage', (data) => {
    const room = socket.room;
    const audio = {
      sender: socket.username,
      audioData: data
    };
    io.to(room).emit('voiceNote', audio);
  });

  socket.on('disconnect', () => {
    const room = socket.room;
    if (room && rooms[room]) {
      rooms[room].users = rooms[room].users.filter(u => u.username !== socket.username);
      io.to(room).emit('message', `${socket.username} left the room.`);
      io.to(room).emit('roomUsers', rooms[room].users);
    }
  });

  // Admin features
  socket.on('adminLogin', (password, cb) => {
    cb(password === adminPassword);
  });

  socket.on('getRooms', (cb) => {
    cb(Object.keys(rooms));
  });

  socket.on('getRoomUsers', (room, cb) => {
    cb(rooms[room]?.users.map(u => u.username) || []);
  });

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

  socket.on('muteUser', ({ room, user }) => {
    logs.push({ room, msg: `${user} was muted by admin.` });
    io.to(room).emit('message', `${user} was muted by admin.`);
  });

  socket.on('getLogs', (room, cb) => {
    cb(logs.filter(l => l.room === room).map(l => l.msg));
  });

  socket.on('getReports', (cb) => {
    cb(reports);
  });
});

server.listen(3000, () => {
  console.log('ShadowTalk server running on port 3000');
});
