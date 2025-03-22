
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(__dirname));

let rooms = {};
let logs = {};

io.on("connection", (socket) => {
  socket.on("requestRoom", (data, callback) => {
    let room = data.roomInput;
    if (!room) {
      const available = Object.entries(rooms).filter(([_, info]) => info.public && info.users.length > 0);
      room = available.length ? available[Math.floor(Math.random() * available.length)][0] : "room-" + Math.floor(Math.random() * 9999);
    }

    if (!rooms[room]) {
      rooms[room] = { public: data.isPublic, users: [], nicknames: {}, logs: [] };
    }

    callback(room);
  });

  socket.on("join", ({ room, name }) => {
    socket.join(room);
    socket.room = room;
    socket.nickname = name;
    rooms[room].users.push(socket.id);
    rooms[room].nicknames[socket.id] = name;
    logs[room] = logs[room] || [];
    logs[room].push(`${name} joined`);

    io.to(room).emit("userList", Object.values(rooms[room].nicknames));
    io.to(room).emit("message", `${name} joined the room.`);
  });

  socket.on("message", ({ room, name, text }) => {
    const msg = `${name}: ${text}`;
    logs[room]?.push(msg);
    io.to(room).emit("message", msg);
  });

  socket.on("typing", ({ room, name }) => {
    socket.to(room).emit("typing", name);
  });

  socket.on("audio", (data) => {
    logs[data.room]?.push(`${data.sender} sent a voice note`);
    io.to(data.room).emit("audio", data);
  });

  socket.on("disconnect", () => {
    const room = socket.room;
    const name = socket.nickname;
    if (room && rooms[room]) {
      delete rooms[room].nicknames[socket.id];
      rooms[room].users = rooms[room].users.filter(id => id !== socket.id);
      logs[room]?.push(`${name} left`);
      io.to(room).emit("message", `${name} left the room.`);
      io.to(room).emit("userList", Object.values(rooms[room].nicknames));
    }
  });

  // Admin actions
  socket.on("admin-login", (password, cb) => {
    cb(password === "shadowadmin");
  });

  socket.on("admin-rooms", () => {
    socket.emit("admin-rooms", Object.keys(rooms));
  });

  socket.on("admin-users", (room) => {
    const users = rooms[room]?.nicknames || {};
    socket.emit("admin-users", users);
  });

  socket.on("admin-logs", (room) => {
    socket.emit("admin-logs", logs[room] || []);
  });

  socket.on("admin-kick", ({ room, target }) => {
    const id = Object.keys(rooms[room]?.nicknames || {}).find(key => rooms[room].nicknames[key] === target);
    if (id) {
      io.to(id).emit("message", "You were kicked by admin.");
      io.sockets.sockets.get(id)?.disconnect();
    }
  });
});

server.listen(3000, () => {
  console.log("ShadowTalk server running at http://localhost:3000");
});
