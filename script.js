
const socket = io();
let name = "", room = "", recording = false;
let mediaRecorder, chunks = [];

document.getElementById("toggleMode").onclick = () => {
  document.body.classList.toggle("dark-mode");
};

function enterChat() {
  name = document.getElementById("nickname").value;
  const roomInput = document.getElementById("roomInput").value;
  const isPublic = document.getElementById("isPublic").checked;
  const password = document.getElementById("roomPassword").value;

  socket.emit("requestRoom", { roomInput, isPublic }, (selectedRoom) => {
    room = selectedRoom;
    document.getElementById("login-box").style.display = "none";
    document.getElementById("chat-box").style.display = "block";
    document.getElementById("room-title").innerText = "Room: " + room;
    socket.emit("join", { room, name, password });
  });
}

function sendMessage() {
  const msg = document.getElementById("messageInput").value;
  if (msg.trim()) {
    socket.emit("message", { room, name, text: msg });
    document.getElementById("messageInput").value = "";
  }
}

function sendTyping() {
  socket.emit("typing", { room, name });
}

function toggleVoice() {
  if (!recording) {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start();
      recording = true;
      chunks = [];

      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        blob.arrayBuffer().then(buffer => {
          socket.emit("audio", { room, sender: name, buffer });
        });
        recording = false;
      };

      setTimeout(() => mediaRecorder.stop(), 5000); // Max 5s recording
    });
  }
}

socket.on("message", msg => {
  const div = document.createElement("div");
  div.textContent = msg;
  document.getElementById("messages").appendChild(div);
  document.getElementById("messages").scrollTop = document.getElementById("messages").scrollHeight;
});

socket.on("typing", user => {
  document.getElementById("typing-indicator").innerText = `${user} is typing...`;
  setTimeout(() => document.getElementById("typing-indicator").innerText = "", 2000);
});

socket.on("audio", data => {
  const blob = new Blob([new Uint8Array(data.buffer)], { type: 'audio/webm' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.controls = true;
  const msg = document.createElement("div");
  msg.innerHTML = `<b>${data.sender}:</b> `;
  msg.appendChild(audio);
  document.getElementById("messages").appendChild(msg);
});

socket.on("userList", list => {
  document.getElementById("user-list").innerText = "Users: " + list.join(", ");
});
