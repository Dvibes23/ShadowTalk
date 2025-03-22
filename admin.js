
const socket = io();
let isAuthenticated = false;

function verify() {
  const pass = document.getElementById('adminPass').value;
  if (pass === "AdUnNi") {
    document.getElementById("auth").style.display = "none";
    document.getElementById("adminPanel").classList.remove("hidden");
    isAuthenticated = true;
  } else {
    alert("Incorrect admin password.");
  }
}

function getRooms() {
  if (!isAuthenticated) return;
  socket.emit('getRooms');
}

socket.on('roomList', (rooms) => {
  const list = document.getElementById("roomList");
  list.innerHTML = '';
  rooms.forEach(room => {
    const li = document.createElement("li");
    li.textContent = room;
    list.appendChild(li);
  });
});

function getUsers() {
  const room = document.getElementById('roomToCheck').value;
  if (!room) return alert("Enter a room name.");
  socket.emit("getUsers", room);
}

socket.on("userList", ({ room, users }) => {
  const list = document.getElementById("userList");
  list.innerHTML = '';
  users.forEach(user => {
    const li = document.createElement("li");
    li.textContent = `${user} (in ${room})`;
    list.appendChild(li);
  });
});

function kick() {
  const user = document.getElementById("userToKick").value;
  const room = document.getElementById("roomTarget").value;
  if (!user || !room) return alert("Enter both username and room name.");
  socket.emit("kick", { target: user, room });
}

function mute() {
  const user = document.getElementById("userToKick").value;
  const room = document.getElementById("roomTarget").value;
  if (!user || !room) return alert("Enter both username and room name.");
  socket.emit("mute", { target: user, room });
}

function getLogs() {
  const room = document.getElementById("logRoom").value;
  if (!room) return alert("Enter a room name for logs.");
  socket.emit("getLogs", room);
}

socket.on("logs", (data) => {
  document.getElementById("logBox").textContent = data.join("\n");
});

function getReports() {
  socket.emit("getReports");
}

socket.on("reports", (data) => {
  const reportBox = document.getElementById("reportBox");
  reportBox.innerHTML = "";
  data.forEach(rep => {
    reportBox.innerHTML += `From: ${rep.reportedUser} | Room: ${rep.room}\nReason: ${rep.reason}\nTime: ${rep.time}\n\n`;
  });
});
