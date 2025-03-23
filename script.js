const socket = io();

let isRecording = false;
let mediaRecorder;
let chunks = [];
let username = '';
let room = '';

const nicknameInput = document.getElementById('nickname');
const roomInput = document.getElementById('room');
const passwordInput = document.getElementById('roomPassword');
const privateRoomCheckbox = document.getElementById('publicRoom'); // now used as private
const chatBox = document.getElementById('chatBox');
const messageInput = document.getElementById('messageInput');
const typingStatus = document.getElementById('typingStatus');
const recordBtn = document.getElementById('recordBtn');
const recordingNotice = document.getElementById('recordingNotice');
const darkToggle = document.getElementById('darkToggle');
const reportModal = document.getElementById('reportModal');

// Enter chat room
function enterChat() {
  username = nicknameInput.value.trim();
  room = roomInput.value.trim() || `room-${Math.floor(Math.random() * 1000)}`;
  const password = passwordInput.value.trim();
  const isPublic = !privateRoomCheckbox.checked; // reversed logic

  if (!username) return alert("Please enter a nickname");

  socket.emit('joinRoom', { username, room, password, isPublic });
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('chatRoom').classList.remove('hidden');
  document.getElementById('roomName').textContent = `Room: ${room}`;
}

// Send message
function sendMessage() {
  const msg = messageInput.value.trim();
  if (msg) {
    socket.emit('chatMessage', msg);
    messageInput.value = '';
  }
}

// Typing event
messageInput.addEventListener('input', () => {
  socket.emit('typing');
});

// Record and send voice note
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
      mediaRecorder.start();
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

      isRecording = true;
      recordBtn.textContent = '■';
      recordingNotice.classList.remove('hidden');
    } catch (err) {
      alert("Microphone access denied.");
    }
  }
}

// Handle dark/light mode toggle
function toggleDarkMode() {
  document.body.classList.toggle('dark', darkToggle.checked);
  localStorage.setItem('darkMode', darkToggle.checked);
}

// Load saved dark mode
window.onload = () => {
  const darkSaved = localStorage.getItem('darkMode') === 'true';
  if (darkSaved) {
    darkToggle.checked = true;
    document.body.classList.add('dark');
  }
};

// Socket Listeners
socket.on('message', msg => {
  const p = document.createElement('p');
  p.innerHTML = msg;
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('displayTyping', user => {
  typingStatus.textContent = `${user} is typing...`;
  setTimeout(() => { typingStatus.textContent = ''; }, 1500);
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

// Report modal functions
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
