const socket = io();

let isRecording = false;
let mediaRecorder;
let chunks = [];
let username = '';
let room = '';
let localStream;
let peerConnection;

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

const TOAST_DURATION = 4000;
const ROOM_PREFIX = 'room-';

function enterChat() {
  username = nicknameInput.value.trim();
  const password = passwordInput.value.trim();
  const isPublic = !privateRoomCheckbox.checked;
  let inputRoom = roomInput.value.trim();

  if (!username) return alert("Please enter a nickname");

  if (!inputRoom && isPublic) {
    socket.emit('findPublicRoom', (foundRoom) => {
      room = foundRoom || generateRandomRoomName();
      joinRoom(room);
    });
  } else {
    room = inputRoom || generateRandomRoomName();
    joinRoom(room);
  }
}

function generateRandomRoomName() {
  return `${ROOM_PREFIX}${Math.floor(Math.random() * 1000)}`;
}

function joinRoom(roomToJoin) {
  room = roomToJoin;
  roomInput.value = room;
  socket.emit('joinRoom', { username, room, password, isPublic });

  document.getElementById('auth').classList.add('hidden');
  document.getElementById('chatRoom').classList.remove('hidden');
  document.getElementById('roomName').textContent = `Room: ${room}`;
  showToast(`Joined room: ${room}`, 'success');
}

function sendMessage() {
  const msg = messageInput.value.trim();
  if (msg) {
    const msgData = { username, text: msg, id: Date.now() };
    socket.emit('chatMessage', msgData);
    messageInput.value = '';
  }
}

messageInput.addEventListener('input', () => {
  socket.emit('typing');
});

async function toggleRecording() {
  if (isRecording) {
    mediaRecorder.stop();
    recordBtn.textContent = '🎤';
    recordingNotice.classList.add('hidden');
    isRecording = false;
  } else {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setupMediaRecorder(stream);
      mediaRecorder.start();
      isRecording = true;
      recordBtn.textContent = '■';
      recordingNotice.classList.remove('hidden');
    } catch (err) {
      alert("Microphone access denied.");
    }
  }
}

function setupMediaRecorder(stream) {
  mediaRecorder = new MediaRecorder(stream);
  chunks = [];

  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onloadend = () => {
      socket.emit('voiceMessage', { sender: username, audioData: reader.result });
    };
    reader.readAsDataURL(blob);
  };
}

const emojiBtn = document.getElementById('emojiBtn');
const picker = new EmojiButton({
  theme: localStorage.getItem('darkMode') === 'true' ? 'dark' : 'light'
});

picker.on('emoji', emoji => {
  messageInput.value += emoji;
});

if (emojiBtn) {
  emojiBtn.addEventListener('click', () => {
    picker.togglePicker(emojiBtn);
  });
}

function createReactions(msgId) {
  const popup = document.createElement('div');
  popup.className = 'reaction-popup';

  ['❤️','😂','👍','😮','😢','🙏','😍'].forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.onclick = () => {
      socket.emit('addReaction', { msgId, emoji });
      popup.remove();
    };
    popup.appendChild(btn);
  });

  return popup;
}

function notify(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(title, { body });
    });
  }
}

socket.on('message', data => {
  const wrapper = document.createElement('div');
  wrapper.className = data.username === username ? 'my-msg' : 'msg';

  const content = document.createElement('div');
  content.className = 'msg-content';
  content.innerHTML = `<strong>${data.username}:</strong> ${sanitize(data.text)}`;
  content.onclick = () => {
    const popup = createReactions(data.id);
    wrapper.appendChild(popup);
    setTimeout(() => popup.remove(), 4000);
  };

  wrapper.appendChild(content);

  if (data.reaction) {
    const reaction = document.createElement('div');
    reaction.className = 'msg-reaction';
    reaction.textContent = data.reaction;
    wrapper.appendChild(reaction);
  }

  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;

  if (data.username !== username) {
    playSound();
    notify(data.username, data.text);
  }
});

socket.on('displayTyping', user => {
  typingStatus.textContent = `${user} is typing...`;
  setTimeout(() => typingStatus.textContent = '', 1500);
});

socket.on('voiceNote', ({ sender, audioData }) => {
  const div = document.createElement('div');
  div.innerHTML = `<strong>${sanitize(sender)} sent a voice note:</strong><br>
    <audio controls src="${audioData}" style="width: 100%;"></audio>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('roomUsers', (users) => {
  const list = users.map(u => sanitize(u.username)).join(', ');
  document.getElementById('usersList').textContent = `Users: ${list}`;
});

socket.on('kicked', () => {
  alert("You were kicked by the support and cannot rejoin this room.");
  window.location.reload();
});

document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark');
    if (darkToggle) darkToggle.checked = true;
  }

  if (darkToggle) {
    darkToggle.addEventListener('change', () => {
      const isDark = darkToggle.checked;
      document.body.classList.toggle('dark', isDark);
      localStorage.setItem('darkMode', isDark);
    });
  }
});

function openReportModal() {
  reportModal.classList.remove('hidden');
}

function closeReportModal() {
  reportModal.classList.add('hidden');
}

function submitReport() {
  const input = document.getElementById("reportTarget").value.trim();
  if (!input) return alert("Please enter full details of your report to the support.");

  fetch("/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report: input })
  }).then(() => {
    alert("Report submitted successfully. Action will be taken shortly.");
    document.getElementById("reportTarget").value = "";
    closeReportModal();
  }).catch(() => {
    alert("Failed to submit report.");
  });
}

function showToast(msg, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), TOAST_DURATION);
}

function playSound() {
  const audio = new Audio('https://cdn.jsdelivr.net/gh/innocenttaylor/chat-sounds/soft-pop.mp3');
  audio.play();
}

function sanitize(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
  }
