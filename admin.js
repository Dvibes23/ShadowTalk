
document.addEventListener('DOMContentLoaded', () => {
  const passwordPrompt = prompt('Enter admin password:');
  if (passwordPrompt !== 'AdUnNi') {
    alert('Access denied!');
    window.location.href = '/';
    return;
  }

  const roomListBtn = document.getElementById('roomListBtn');
  const getUsersBtn = document.getElementById('getUsersBtn');
  const kickBtn = document.getElementById('kickBtn');
  const muteBtn = document.getElementById('muteBtn');
  const viewLogsBtn = document.getElementById('viewLogsBtn');
  const viewReportsBtn = document.getElementById('viewReportsBtn');

  roomListBtn.onclick = () => {
    fetch('/admin/rooms')
      .then(res => res.json())
      .then(data => {
        alert('Active Rooms:\n' + data.rooms.join('\n'));
      });
  };

  getUsersBtn.onclick = () => {
    const room = document.getElementById('roomInput').value;
    fetch(`/admin/room-users/${room}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error);
        } else {
          alert(`Users in ${room}:\n` + data.users.join('\n'));
        }
      });
  };

  kickBtn.onclick = () => {
    const user = document.getElementById('userInput').value;
    const room = document.getElementById('roomInput').value;
    fetch('/admin/kick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, room })
    })
      .then(res => res.json())
      .then(data => alert(data.message));
  };

  muteBtn.onclick = () => {
    const user = document.getElementById('userInput').value;
    const room = document.getElementById('roomInput').value;
    fetch('/admin/mute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, room })
    })
      .then(res => res.json())
      .then(data => alert(data.message));
  };

  viewLogsBtn.onclick = () => {
    const room = document.getElementById('logRoomInput').value;
    fetch(`/admin/logs/${room}`)
      .then(res => res.json())
      .then(data => {
        alert(`Logs for ${room}:\n` + data.logs.join('\n'));
      });
  };

  viewReportsBtn.onclick = () => {
    fetch('/admin/reports')
      .then(res => res.json())
      .then(data => {
        alert('Reports:\n' + data.reports.join('\n\n'));
      });
  };
});
