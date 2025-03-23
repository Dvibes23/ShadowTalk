const socket = io();
const messageInput = document.getElementById('messageInput');
const chatBox = document.getElementById('chatBox');
const sendButton = document.getElementById('sendButton');
const micButton = document.getElementById('micButton');
const recordingNotice = document.getElementById('recordingNotice');
const typingStatus = document.getElementById('typingStatus');
const toggle = document.getElementById('modeToggle');
const reportBtn = document.getElementById('reportBtn');
const reportModal = document.getElementById('reportModal');
const reportForm = document.getElementById('reportForm');
const closeReport = document.getElementById('closeReport');

let isRecording = false;
let mediaRecorder;
let chunks = [];
let username = '';
let room = '';

// Join room
document.getElementById('joinForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  username = document.getElementById('username').value;
  room = document.getElementById('room').value;
  const password = document.getElementById('roomPass').value;

  socket.emit('joinRoom', { username, room, password });
  document.getElementById('loginArea').classList.add('hidden');
  document.getElementById('chatArea').classList.remove('hidden');
  document.getElementById('roomName').textContent = `Room: ${room}`;
});

// Send message
sendButton?.addEventListener('click', () => {
  const msg = messageInput.value.trim();
  if (msg) {
    socket.emit('chatMessage', msg);
    messageInput.value = '';
  }
});

// Typing indicator
messageInput?.addEventListener('input', () => {
  socket.emit('typing');
});

// Voice recording
micButton?.addEventListener('click', async () => {
  if (isRecording) {
    mediaRecorder.stop();
    micButton.textContent = '🎤';
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
    micButton.textContent = '■';
    recordingNotice.classList.remove('hidden');
  }
});

// Receive message
socket.on('message', (msg) => {
  const p = document.createElement('p');
  p.innerHTML = msg;
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// Typing
socket.on('displayTyping', (user) => {
  typingStatus.textContent = `${user} is typing...`;
  setTimeout(() => {
    typingStatus.textContent = '';
  }, 1500);
});

// Receive voice note
socket.on('voiceNote', ({ sender, audioData }) => {
  const div = document.createElement('div');
  div.innerHTML = `<strong>${sender} sent a voice note:</strong><br>
  <audio controls src="${audioData}" style="width: 100%"></audio>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

// Toggle theme
toggle?.addEventListener('change', () => {
  document.body.style.backgroundColor = toggle.checked ? '#fff' : '#000';
  document.body.style.color = toggle.checked ? '#000' : '#0f0';
});

// REPORT FUNCTIONALITY
function showReportPrompt() {
  const reportModal = document.createElement("div");
  reportModal.id = "reportModal";
  reportModal.innerHTML = `
    <div class="report-content">
      <h3>Report a user or message</h3>
      <input type="text" id="reportInput" placeholder="Username or issue..." />
      <button onclick="submitReport()">Submit Report</button>
      <button onclick="cancelReport()">Cancel</button>
    </div>
  `;
  document.body.appendChild(reportModal);
}

// Submit report
function submitReport() {
  const input = document.getElementById("reportInput").value.trim();
  if (!input) return alert("Please enter a report detail.");

  fetch("/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report: input }),
  })
    .then((res) => res.json())
    .then((data) => {
      alert("Report submitted successfully.");
      cancelReport();
    })
    .catch(() => {
      alert("Error sending report.");
    });
}

// Cancel report
function cancelReport() {
  const reportModal = document.getElementById("reportModal");
  if (reportModal) {
    reportModal.remove();
  }
}
