const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Hacker Terminal Chat</title>
    <style>
        body { background: #0a0e14; color: #00ff66; font-family: monospace; padding: 20px; display: flex; flex-direction: column; height: 90vh; }
        #chat { flex: 1; background: #05080c; border: 1px solid #00ff66; padding: 15px; overflow-y: auto; margin-bottom: 15px; box-shadow: inset 0 0 10px rgba(0,255,102,0.2); }
        .line { margin-bottom: 8px; }
        .user { color: #ff7b72; font-weight: bold; }
        input { background: transparent; border: 1px solid #00ff66; color: #00ff66; padding: 12px; font-family: monospace; width: 100%; outline: none; font-size: 16px; }
    </style>
    <script src="/socket.io/socket.io.js"></script>
</head>
<body>
    <div id="chat"><div>[SYSTEM]: Secure Connection Established... Ready to Chat.</div></div>
    <input type="text" id="in" placeholder="Type message and press Enter..." autofocus autocomplete="off">
    <script>
        const socket = io();
        const myId = 'hacker_' + Math.floor(Math.random() * 899 + 100);
        const input = document.getElementById('in');
        const chat = document.getElementById('chat');
        
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && this.value.trim() !== '') {
                socket.emit('msg', { sender: myId, text: this.value });
                this.value = '';
            }
        });
        
        socket.on('srv_msg', function(data) {
            const div = document.createElement('div');
            div.className = 'line';
            div.innerHTML = '[System.Out] <span class="user">' + data.sender + '</span>: "' + data.text + '"';
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        });
    </script>
</body>
</html>
    `);
});

io.on('connection', (socket) => {
    socket.on('msg', (data) => { io.emit('srv_msg', data); });
});

server.listen(3000, () => {
    console.log('========================================');
    console.log('🚀 TERMINAL CHAT SERVER ONLINE!');
    console.log('👉 Open in browser: http://localhost:3000');
    console.log('========================================');
});
