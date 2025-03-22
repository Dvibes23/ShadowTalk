const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const rooms = {};
const publicRooms = new Set();
const logs = {};
const reports = [];

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/admin', (req, res) => res.sendFile(__dirname + '/admin.html'));

io.on('connection', socket => {
  socket.on('join', ({ nickname, room, isPublic, password }) => {
    if (!rooms[room]) rooms[room] = { users: {}, public: isPublic, password: password || '' };
    if (rooms[room].password && rooms[room].password !== password) {
      socket.emit('message', '<em>Incorrect room password!</em>');
      return;
    }

    socket.join(room);
    socket.room = room;
    socket.nickname = nickname;
    rooms[room].users[socket.id] = nickname;
    if (isPublic) publicRooms.add(room);

    io.to(room).emit('message', `Welcome ${nickname}!`);
    io.to(room).emit('users', Object.values(rooms[room].users));
    saveLog(room, `${nickname} joined.`)
  });

  socket.on('message', ({ message, room, nickname }) => {
    const formatted = `${nickname}: ${message}`;
    io.to(room).emit('message', formatted);
    saveLog(room, formatted);
  });

  socket.on('voice', ({ blob, sender, room }) => {
    io.to(room).emit('voice', { blob, sender });
    saveLog(room, `${sender} sent a voice note`);
  });

  socket.on('typing', ({ nickname, room }) => {
    socket.to(room).emit('typing', nickname);
  });

  socket.on('report', ({ reportedUser, reason, room }) => {
    reports.push({ reportedUser, reason, room, time: new Date().toISOString() });
  });

  socket.on('kick', ({ target, room }) => {
    const targetId = Object.keys(rooms[room].users).find(id => rooms[room].users[id] === target);
    if (targetId) {
      io.to(targetId).emit('message', 'You have been kicked by the admin.');
      io.sockets.sockets.get(targetId).disconnect();
    }
  });

  socket.on('mute', ({ target, room }) => {
    const targetId = Object.keys(rooms[room].users).find(id => rooms[room].users[id] === target);
    if (targetId) io.to(targetId).emit('message', 'You have been muted by the admin.');
  });

  socket.on('getRooms', () => {
    socket.emit('roomList', Array.from(publicRooms));
  });

  socket.on('getUsers', room => {
    const userList = rooms[room] ? Object.values(rooms[room].users) : [];
    socket.emit('userList', { room, users: userList });
  });

  socket.on('getLogs', room => {
    socket.emit('logs', logs[room] || []);
  });

  socket.on('getReports', () => {
    socket.emit('reports', reports);
  });

  socket.on('disconnect', () => {
    const room = socket.room;
    if (room && rooms[room]) {
      const nickname = rooms[room].users[socket.id];
      delete rooms[room].users[socket.id];
      io.to(room).emit('message', `${nickname} left the room.`);
      io.to(room).emit('users', Object.values(rooms[room].users));
      saveLog(room, `${nickname} left.`);
    }
  });
});

function saveLog(room, msg) {
  if (!logs[room]) logs[room] = [];
  logs[room].push(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

http.listen(3000, () => console.log('ShadowTalk server running on http://localhost:3000'));
