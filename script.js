
const socket = io();
let room = '';
let nickname = '';
let mediaRecorder;
let audioChunks = [];

document.getElementById('toggleMode').addEventListener('change', () => {
  document.body.classList.toggle('light');
});

document.getElementById('messageInput').addEventListener('input', () => {
  socket.emit('typing', { nickname, room });
});

function enterChat() {
  nickname = document.getElementById('nickname').value.trim() || 'Anonymous';
  room = document.getElementById('room').value.trim() || 'room-' + Math.floor(Math.random() * 1000);
  const isPublic = document.getElementById('publicRoom').checked;
  const password = document.getElementById('roomPassword').value;

  socket.emit('join', { nickname, room, isPublic, password });

  document.getElementById('entry').classList.add('hidden');
  document.getElementById('chat').classList.remove('hidden');
  document.getElementById('roomName').textContent = `Room: ${room}`;
}

function sendMessage() {
  const message = document.getElementById('messageInput').value.trim();
  if (message) {
    socket.emit('message', { message, room, nickname });
    document.getElementById('messageInput').value = '';
  }
}

function appendMessage(content) {
  const div = document.createElement('div');
  div.innerHTML = content;
  document.getElementById('messages').appendChild(div);
  document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
}

socket.on('message', appendMessage);

socket.on('typing', user => {
  document.getElementById('typing').textContent = `${user} is typing...`;
  setTimeout(() => {
    document.getElementById('typing').textContent = '';
  }, 2000);
});

socket.on('users', users => {
  document.getElementById('usersInRoom').textContent = 'Users: ' + users.join(', ');
});

socket.on('voice', ({ blob, sender }) => {
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.src = blob;
  appendMessage(`<strong>${sender} sent a voice note:</strong><br>`);
  document.getElementById('messages').appendChild(audio);
});

document.getElementById('recordBtn').addEventListener('click', async () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      socket.emit('voice', { blob: url, sender: nickname, room });
    };

    appendMessage(`<em>Recording started...</em>`);
    setTimeout(() => mediaRecorder.stop(), 5000); // Auto-stop after 5 seconds
  }
});
