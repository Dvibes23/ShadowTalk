const socket = io();

let isRecording = false;
let mediaRecorder;
let chunks = [];
let username = '';
let room = '';

const nicknameInput = document.getElementById('nickname');
const roomInput = document.getElementById('room');
const passwordInput = document.getElementById('roomPassword');
const privateRoomCheckbox = document.getElementById('privateRoom');
const chatBox = document.getElementById('chatBox');
const messageInput = document.getElementById('messageInput');
const typingStatus = document.getElementById('typingStatus');
const recordBtn = document.getElementById('recordBtn');
const recordingNotice = document.getElementById('recordingNotice');
const darkToggle = document.getElementById('darkToggle');
const reportModal = document.getElementById('reportModal');

// JOIN CHAT ROOM
function enterChat() {
  username = nicknameInput.value.trim();
  room = roomInput.value.trim(); // can be blank
  const password = passwordInput.value.trim();
  const isPublic = !privateRoomCheckbox.checked;

  if (!username) return alert("Please enter a nickname");

  socket.emit('joinRoom', { username, room, password, isPublic });

  document.getElementById('auth').classList.add('hidden');
  document.getElementById('chatRoom').classList.remove('hidden');
  document.getElementById('roomName').textContent = `Room: ${room || "Auto-selected"}`;
}

// SEND MESSAGE
function sendMessage() {
  const msg = messageInput.value.trim();
  if (msg) {
    socket.emit('chatMessage', msg);
    messageInput.value = '';
  }
}

// TYPING INDICATOR
messageInput.addEventListener('input', () => {
  socket.emit('typing');
});

// VOICE RECORDING
async function toggleRecording() {
  if (isRecording) {
    mediaRecorder.stop();
    recordBtn.textContent = '🎤';
    recordingNotice.classList.add('hidden');
    isRecording = false;
  } else {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];

      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          socket.emit('voiceMessage', reader.result);
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      isRecording = true;
      recordBtn.textContent = '■';
      recordingNotice.classList.remove('hidden');
    } catch (err) {
      alert("Microphone access denied.");
    }
  }
}

// DARK MODE
function toggleDarkMode() {
  const isDark = darkToggle?.checked;
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('darkMode', isDark);
}

window.onload = () => {
  const darkSaved = localStorage.getItem('darkMode') === 'true';
  if (darkSaved) {
    document.body.classList.add('dark');
    if (darkToggle) darkToggle.checked = true;
  }
};

// MESSAGES
socket.on('message', msg => {
  const p = document.createElement('p');
  p.innerHTML = msg;
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('displayTyping', user => {
  typingStatus.textContent = `${user} is typing...`;
  setTimeout(() => {
    typingStatus.textContent = '';
  }, 1500);
});

socket.on('voiceNote', ({ sender, audioData }) => {
  const div = document.createElement('div');
  div.innerHTML = `<strong>${sender} sent a voice note:</strong><br>
  <audio controls src="${audioData}" style="width: 100%;"></audio>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('roomUsers', (users) => {
  const list = users.map(u => u.username).join(', ');
  document.getElementById('usersList').textContent = `Users: ${list}`;
});

socket.on('kicked', (roomName) => {
  alert("You were kicked by an admin and cannot rejoin this room.");
  window.location.reload();
});

// REPORT
function openReportModal() {
  reportModal.classList.remove('hidden');
}

function closeReportModal() {
  reportModal.classList.add('hidden');
}

function submitReport() {
  const input = document.getElementById("reportTarget").value.trim();
  if (!input) return alert("Please enter something to report.");

  fetch("/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report: input })
  }).then(() => {
    alert("Report submitted successfully.");
    document.getElementById("reportTarget").value = "";
    closeReportModal();
  }).catch(() => {
    alert("Failed to submit report.");
  });
}
