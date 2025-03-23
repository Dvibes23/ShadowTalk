const socket = io();

// Password verification
function verify() {
  const password = document.getElementById("adminPass").value;
  socket.emit("adminLogin", password, (isValid) => {
    if (isValid) {
      document.getElementById("auth").classList.add("hidden");
      document.getElementById("adminPanel").classList.remove("hidden");
    } else {
      alert("Incorrect password.");
    }
  });
}

// Show all active rooms
function getRooms() {
  socket.emit("getRooms", (rooms) => {
    const list = document.getElementById("roomList");
    list.innerHTML = "";
    rooms.forEach((room) => {
      const li = document.createElement("li");
      li.textContent = room;
      list.appendChild(li);
    });
  });
}

// Show users in selected room
function getUsers() {
  const room = document.getElementById("roomToCheck").value.trim();
  if (!room) return alert("Enter room name");

  socket.emit("getRoomUsers", room, (users) => {
    const ul = document.getElementById("userList");
    ul.innerHTML = "";
    users.forEach((user) => {
      const li = document.createElement("li");
      li.textContent = user;
      ul.appendChild(li);
    });
  });
}

// Kick user
function kick() {
  const room = document.getElementById("roomTarget").value.trim();
  const user = document.getElementById("userToKick").value.trim();
  if (!room || !user) return alert("Enter both username and room");

  socket.emit("kickUser", { room, user });
  alert(`${user} has been kicked from ${room}`);
}

// Mute user
function mute() {
  const room = document.getElementById("roomTarget").value.trim();
  const user = document.getElementById("userToKick").value.trim();
  if (!room || !user) return alert("Enter both username and room");

  socket.emit("muteUser", { room, user });
  alert(`${user} has been muted in ${room}`);
}

// View logs
function getLogs() {
  const room = document.getElementById("logRoom").value.trim();
  if (!room) return alert("Enter room name");

  socket.emit("getLogs", room, (logs) => {
    document.getElementById("logBox").textContent = logs.join("\n");
  });
}

// View reports
function getReports() {
  socket.emit("getReports", (reports) => {
    document.getElementById("reportBox").textContent = reports.join("\n\n");
  });
}
