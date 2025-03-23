const socket = io();

// Admin login
function verify() {
  const password = document.getElementById("adminPass").value.trim();
  socket.emit("adminLogin", password, (valid) => {
    if (valid) {
      document.getElementById("auth").classList.add("hidden");
      document.getElementById("adminPanel").classList.remove("hidden");
    } else {
      alert("Incorrect password");
    }
  });
}

// Show active rooms
function getRooms() {
  socket.emit("getRooms", (rooms) => {
    const roomList = document.getElementById("roomList");
    roomList.innerHTML = "";

    if (!rooms.length) {
      roomList.innerHTML = "<li>No active rooms</li>";
      return;
    }

    rooms.forEach((room) => {
      const li = document.createElement("li");
      li.textContent = room;
      roomList.appendChild(li);
    });
  });
}

// Show users in a specific room
function getUsers() {
  const room = document.getElementById("roomToCheck").value.trim();
  if (!room) return alert("Please enter a room name.");

  socket.emit("getRoomUsers", room, (users) => {
    const userList = document.getElementById("userList");
    userList.innerHTML = "";

    if (!users.length) {
      userList.innerHTML = "<li>No users in this room</li>";
      return;
    }

    users.forEach((user) => {
      const li = document.createElement("li");
      li.textContent = user;
      userList.appendChild(li);
    });
  });
}

// Kick a user from a room
function kick() {
  const user = document.getElementById("userToKick").value.trim();
  const room = document.getElementById("roomTarget").value.trim();

  if (!user || !room) return alert("Enter both username and room");

  socket.emit("kickUser", { room, user });
  alert(`${user} has been kicked from ${room}`);
}

// Mute a user in a room
function mute() {
  const user = document.getElementById("userToKick").value.trim();
  const room = document.getElementById("roomTarget").value.trim();

  if (!user || !room) return alert("Enter both username and room");

  socket.emit("muteUser", { room, user });
  alert(`${user} has been muted in ${room}`);
}

// View room logs
function getLogs() {
  const room = document.getElementById("logRoom").value.trim();
  if (!room) return alert("Enter room name");

  socket.emit("getLogs", room, (logs) => {
    const logBox = document.getElementById("logBox");
    logBox.textContent = logs.length ? logs.join("\n") : "No logs found for this room.";
  });
}

// View reports (and auto-remove after viewing)
function getReports() {
  socket.emit("getReports", (reports) => {
    const box = document.getElementById("reportBox");

    if (!reports.length) {
      box.textContent = "No pending reports.";
    } else {
      box.textContent = reports.join("\n\n");
      // Optionally clear reports after review (on backend too)
      reports.length = 0;
    }
  });
}
