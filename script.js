const socket = io();

let isRecording = false;
let mediaRecorder;
let chunks = [];
let username = '';
let room = '';
let kickedUsers = {};

const nicknameInput = document.getElementById('nickname');
const roomInput = document.getElementById('room');
const passwordInput = document.getElementById('roomPassword');
const chatBox = document.getElementById('chatBox');
const messageInput = document.getElementById('messageInput');
const typingStatus = document.getElementById('typingStatus');
const recordBtn = document.getElementById('recordBtn');
const recordingNotice = document.getElementById('recordingNotice');
const darkToggle = document.getElementById('darkToggle');
const reportModal = document.getElementById('reportModal');

// Enter chat
function enterChat() {
  username = nicknameInput.value.trim();
  room = roomInput.value.trim() || `room-${Math.floor(Math.random() * 1000)}`;
  const password = passwordInput.value.trim();
  const isPublic = document.getElementById('publicRoom').checked;

  if (!username) return alert("Please enter a nickname");

  socket.emit('joinRoom', { username, room, password, isPublic });
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('chatRoom').classList.remove('hidden');
  document.getElementById('roomName').textContent = `Room: ${room}`;
}

// Send text message
function sendMessage() {
  const msg = messageInput.value.trim();
  if (msg) {
    socket.emit('chatMessage', msg);
    messageInput.value = '';
  }
}

// Show typing
messageInput.addEventListener('input', () => {
  socket.emit('typing');
});

// Start/Stop recording
async function toggleRecording() {
  if (isRecording) {
    mediaRecorder.stop();
    recordBtn.textContent = '🎤';
    recordingNotice.classList.add('hidden');
    isRecording = false;
  } else {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    chunks = [];

    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        socket.emit('voiceMessage', reader.result);
      };
      reader.readAsDataURL(blob);
    };

    isRecording = true;
    recordBtn.textContent = '■';
    recordingNotice.classList.remove('hidden');
  }
}

// Toggle dark/light mode
function toggleDarkMode() {
  document.body.classList.toggle('dark', darkToggle.checked);
}
window.onload = () => {
  if (localStorage.getItem('darkMode') === 'true') {
    darkToggle.checked = true;
    document.body.classList.add('dark');
  }
};

// Show incoming messages
socket.on('message', (msg) => {
  const p = document.createElement('p');
  p.innerHTML = msg;
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// Typing display
socket.on('displayTyping', (user) => {
  typingStatus.textContent = `${user} is typing...`;
  setTimeout(() => {
    typingStatus.textContent = '';
  }, 1500);
});

// Voice message display
socket.on('voiceNote', ({ sender, audioData }) => {
  const div = document.createElement('div');
  div.innerHTML = `<strong>${sender} sent a voice note:</strong><br>
  <audio controls src="${audioData}" style="width: 100%"></audio>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// Show users in room
socket.on('roomUsers', (users) => {
  const userList = users.map(user => user.username).join(', ');
  document.getElementById('usersList').textContent = `Users: ${userList}`;
});

// Handle kick
socket.on('kicked', (room) => {
  alert("You have been kicked from this room.");
  window.location.reload();
});

// Report button
function openReportModal() {
  document.getElementById("reportModal").classList.remove("hidden");
}

function closeReportModal() {
  document.getElementById("reportModal").classList.add("hidden");
}

// Submit report
function submitReport() {
  const input = document.getElementById("reportTarget").value.trim();
  if (!input) return alert("Please enter something to report.");

  fetch("/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report: input })
  }).then(() => {
    alert("Report submitted.");
    closeReportModal();
  }).catch(() => {
    alert("Failed to send report.");
  });
}
