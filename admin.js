
const socket = io();
let selectedRoom = "";

function login() {
  const pass = document.getElementById("adminPass").value;
  socket.emit("admin-login", pass, (success) => {
    if (success) {
      document.getElementById("login-box").style.display = "none";
      document.getElementById("adminPanel").style.display = "block";
      socket.emit("admin-rooms");
    } else {
      alert("Incorrect password");
    }
  });
}

socket.on("admin-rooms", (rooms) => {
  const roomList = document.getElementById("roomList");
  roomList.innerHTML = "";
  rooms.forEach(room => {
    const li = document.createElement("li");
    li.textContent = room;
    li.onclick = () => {
      selectedRoom = room;
      document.getElementById("currentRoom").textContent = room;
      socket.emit("admin-users", room);
    };
    roomList.appendChild(li);
  });
});

socket.on("admin-users", (users) => {
  const list = document.getElementById("userList");
  list.innerHTML = "";
  Object.values(users).forEach(user => {
    const li = document.createElement("li");
    li.textContent = user;
    list.appendChild(li);
  });
});

function kickUser() {
  const target = document.getElementById("targetUser").value;
  if (selectedRoom && target) {
    socket.emit("admin-kick", { room: selectedRoom, target });
    alert("Kick signal sent");
  }
}

function loadLogs() {
  socket.emit("admin-logs", selectedRoom);
}

socket.on("admin-logs", (data) => {
  document.getElementById("logs").textContent = data.join("\n");
});
