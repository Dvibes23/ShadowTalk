const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {};
const logs = [];
const reports = [];
const kickedUsers = {};

app.use(express.static(__dirname));

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

let adminPassword = 'AdUnNi';

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ username, room, password }) => {
    if (kickedUsers[room]?.includes(username)) {
      socket.emit('message', `You were kicked from this room.`);
      return;
    }

    if (!rooms[room]) {
      rooms[room] = { users: [], isPublic: true, password };
    }

    if (rooms[room].password && rooms[room].password !== password) {
      socket.emit('message', 'Incorrect room password.');
      return;
    }

    socket.username = username;
    socket.room = room;
    socket.join(room);

    rooms[room].users.push(username);

    io.to(room).emit('message', `Welcome ${username}!`);
    io.to(room).emit('message', `Users: ${rooms[room].users.join(', ')}`);
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
    const audio = {
      sender: socket.username,
      audioData: data
    };
    io.to(socket.room).emit('voiceNote', audio);
  });

  socket.on('disconnect', () => {
    const room = socket.room;
    if (room && rooms[room]) {
      rooms[room].users = rooms[room].users.filter(u => u !== socket.username);
      io.to(room).emit('message', `${socket.username} left the room.`);
    }
  });

  // Admin Panel Events
  socket.on('adminLogin', (password, cb) => {
    cb(password === adminPassword);
  });

  socket.on('getRooms', (cb) => {
    cb(Object.keys(rooms));
  });

  socket.on('getRoomUsers', (room, cb) => {
    cb(rooms[room]?.users || []);
  });

  socket.on('kickUser', ({ room, user }) => {
    kickedUsers[room] = kickedUsers[room] || [];
    kickedUsers[room].push(user);
    logs.push({ room, msg: `${user} was kicked by admin.` });
    io.to(room).emit('message', `${user} was kicked by admin.`);
    io.sockets.sockets.forEach(s => {
      if (s.username === user && s.room === room) {
        s.leave(room);
        s.emit('message', 'You have been kicked from the room.');
      }
    });
  });

  socket.on('muteUser', ({ room, user }) => {
    logs.push({ room, msg: `${user} was muted by admin.` });
    io.to(room).emit('message', `${user} was muted by admin.`);
  });

  socket.on('getLogs', (room, cb) => {
    cb(logs.filter(l => l.room === room));
  });

  // Reports
  socket.on('reportUser', ({ username, room, reason }) => {
    reports.push({ username, room, reason, time: new Date() });
  });

  socket.on('getReports', (cb) => {
    cb(reports);
  });
});

server.listen(3000, () => {
  console.log('Phase 3 backend integration complete.');
});
