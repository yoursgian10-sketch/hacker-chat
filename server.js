
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 1000;

let messageHistory = [];
let nextUserNumber = 100;

// Assign a server-controlled identity to each connection.
io.on('connection', (socket) => {
    nextUserNumber = nextUserNumber >= 999 ? 100 : nextUserNumber + 1;
    socket.data.username = 'hacker_' + nextUserNumber;

    const username = socket.data.username;

    socket.emit('setIdentity', username);
    socket.emit('loadHistory', messageHistory.map(publicMessage));

    socket.on('msg', (data) => {
        if (!data || typeof data.text !== 'string') return;

        const text = data.text.trim().slice(0, MAX_MESSAGE_LENGTH);
        if (!text) return;

        let replyTo = null;

        // Only accept replies to existing messages.
        if (data.replyTo && typeof data.replyTo.id === 'string') {
            const original = messageHistory.find(
                (message) => message.id === data.replyTo.id
            );

            if (original && !original.isDeleted) {
                replyTo = {
                    id: original.id,
                    sender: original.sender,
                    text: original.text.slice(0, 50)
                };
            }
        }

        const message = {
            id: 'msg_' + Date.now() + '_' +
                Math.random().toString(36).slice(2, 9),
            sender: username,
            text,
            replyTo,
            isDeleted: false,

            // Private server-side ownership information.
            ownerSocketId: socket.id
        };

        messageHistory.push(message);

        if (messageHistory.length > MAX_MESSAGES) {
            messageHistory.shift();
        }

        io.emit('srv_msg', publicMessage(message));
    });

    socket.on('delete_request', (msgId) => {
        if (typeof msgId !== 'string') return;

        const message = messageHistory.find(
            (item) => item.id === msgId
        );

        // Only the connection that sent the message can delete it.
        if (
            !message ||
            message.isDeleted ||
            message.ownerSocketId !== socket.id
        ) {
            return;
        }

        message.isDeleted = true;
        message.text = '[Message deleted by sender]';
        message.replyTo = null;

        io.emit('msg_deleted', message.id);
    });
});

function publicMessage(message) {
    return {
        id: message.id,
        sender: message.sender,
        text: message.text,
        replyTo: message.replyTo,
        isDeleted: message.isDeleted
    };
}

app.get('/', (req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hacker Terminal Chat</title>
    <style>
        * { box-sizing: border-box; }

        body {
            margin: 0;
            padding: 20px;
            background: #0a0e14;
            color: #00ff66;
            font-family: monospace;
            height: 100dvh;
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        }

        h2 {
            margin: 0;
            font-size: 18px;
        }

        #identity {
            color: #8ab4f8;
            font-size: 12px;
        }

        #chat {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            background: #05080c;
            border: 1px solid #00ff66;
            padding: 15px;
            box-shadow: inset 0 0 10px rgba(0,255,102,.15);
            overflow-wrap: anywhere;
        }

        .line {
            position: relative;
            padding: 7px 4px;
            margin-bottom: 5px;
            border-radius: 4px;
        }

        .line:hover { background: rgba(0,255,102,.05); }
        .system { color: #00ff66; font-weight: bold; }
        .user { color: #ff7b72; font-weight: bold; }
        .command-help { color: #8ab4f8; }

        .msg-actions {
            display: none;
            gap: 5px;
            margin-top: 6px;
        }

        .line:hover .msg-actions,
        .line:focus-within .msg-actions {
            display: flex;
        }

        .action-btn {
            background: #0a0e14;
            border: 1px solid #00ff66;
            color: #00ff66;
            cursor: pointer;
            padding: 4px 8px;
            font-family: monospace;
        }

        .action-btn:hover {
            background: #00ff66;
            color: #0a0e14;
        }

        .delete-btn {
            border-color: #ff7b72;
            color: #ff7b72;
        }

        .reply-box {
            color: #8ab4f8;
            border-left: 2px solid #8ab4f8;
            padding: 4px 8px;
            margin-bottom: 6px;
            font-size: 12px;
            white-space: pre-wrap;
        }

        #reply-preview-bar {
            display: none;
            background: #161b22;
            border: 1px solid #8ab4f8;
            padding: 10px;
            color: #8ab4f8;
            font-size: 12px;
            overflow-wrap: anywhere;
        }

        #cancel-reply-btn {
            float: right;
            cursor: pointer;
            color: #ff7b72;
            margin-left: 10px;
        }

        #input-row { display: flex; gap: 8px; }

        input {
            flex: 1;
            min-width: 0;
            background: transparent;
            border: 1px solid #00ff66;
            color: #00ff66;
            padding: 12px;
            font-family: monospace;
            font-size: 16px;
            outline: none;
        }

        input:focus { box-shadow: 0 0 5px rgba(0,255,102,.3); }

        #send-btn {
            background: #00ff66;
            border: 1px solid #00ff66;
            color: #0a0e14;
            padding: 0 16px;
            cursor: pointer;
            font-family: monospace;
            font-weight: bold;
        }

        .deleted-msg {
            color: #777 !important;
            font-style: italic;
        }

        @media (max-width: 500px) {
            body { padding: 10px; }
            #chat { padding: 10px; }
            .line { font-size: 13px; }
        }
    </style>
    <script src="/socket.io/socket.io.js"></script>
</head>
<body>
    <header>
        <h2>TERMINAL_CHAT // ONLINE</h2>
        <span id="identity">Connecting...</span>
    </header>

    <div id="chat" aria-live="polite">
        <div class="line system">
            [SYSTEM]: Establishing secure connection...
            Type /help for commands.
        </div>
    </div>

    <div id="reply-preview-bar">
        <span id="reply-details"></span>
        <span id="cancel-reply-btn" role="button" tabindex="0"
            onclick="cancelReply()">[X] Cancel</span>
    </div>

    <div id="input-row">
        <input type="text" id="in"
            placeholder="Type message and press Enter..."
            maxlength="1000" autocomplete="off" autofocus>
        <button id="send-btn" type="button" onclick="sendMessage()">SEND</button>
    </div>

    <script>
        const socket = io();
        const input = document.getElementById('in');
        const chat = document.getElementById('chat');

        let myId = '';
        let activeReplyId = null;
        let activeReplyData = null;

        socket.on('connect', () => {
            printSystemMessage('Connected to terminal server.');
        });

        socket.on('disconnect', () => {
            printSystemMessage('Connection lost. Reconnecting...');
        });

        socket.on('setIdentity', (username) => {
            myId = username;
            document.getElementById('identity').textContent =
                'USER: ' + username;
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') sendMessage();
        });

        function sendMessage() {
            const text = input.value.trim();
            if (!text) return;

            if (text === '/help') {
                printSystemMessage(
                    '/help - Show commands\\n' +
                    '/clear - Clear your local screen\\n' +
                    'Hover over your messages to Reply or Delete.'
                );
                input.value = '';
                return;
            }

            if (text === '/clear') {
                chat.replaceChildren();
                printSystemMessage('Terminal cleared locally.');
                cancelReply();
                input.value = '';
                return;
            }

            if (!socket.connected) {
                printSystemMessage('Not connected. Please try again.');
                return;
            }

            socket.emit('msg', {
                text,
                replyTo: activeReplyId
                    ? { id: activeReplyId }
                    : null
            });

            cancelReply();
            input.value = '';
            input.focus();
        }

        socket.on('loadHistory', (history) => {
            chat.replaceChildren();
            printSystemMessage('Connection established. History loaded.');

            history.forEach(printMessage);
            scrollToBottom();
        });

        socket.on('srv_msg', (data) => {
            printMessage(data);
            scrollToBottom();
        });

        socket.on('msg_deleted', (msgId) => {
            const msgDiv = document.getElementById(msgId);
            if (!msgDiv) return;

            const content = msgDiv.querySelector('.msg-content');
            if (content) {
                content.textContent = '"[Message deleted by sender]"';
                content.className = 'msg-content deleted-msg';
            }

            const replyBox = msgDiv.querySelector('.reply-box');
            if (replyBox) replyBox.remove();

            const actions = msgDiv.querySelector('.msg-actions');
            if (actions) actions.remove();
        });

        function printMessage(data) {
            // Prevent duplicate DOM entries.
            if (!data || !data.id || document.getElementById(data.id)) return;

            const div = document.createElement('div');
            div.className = 'line';
            div.id = data.id;

            if (data.isDeleted) {
                appendMessageBody(div, data.sender,
                    '[Message deleted by sender]', true);
                chat.appendChild(div);
                return;
            }

            if (data.replyTo) {
                const replyPreview = document.createElement('div');
                replyPreview.className = 'reply-box';
                replyPreview.textContent =
                    '↳ Replying to @' + data.replyTo.sender + ': "' +
                    data.replyTo.text.slice(0, 50) + '"';
                div.appendChild(replyPreview);
            }

            appendMessageBody(div, data.sender, data.text, false);

            const actions = document.createElement('div');
            actions.className = 'msg-actions';

            const replyBtn = document.createElement('button');
            replyBtn.type = 'button';
            replyBtn.className = 'action-btn';
            replyBtn.textContent = 'Reply';
            replyBtn.onclick = () =>
                initiateReply(data.id, data.sender, data.text);
            actions.appendChild(replyBtn);

            // UI check for convenience; server independently validates ownership.
            if (data.sender === myId) {
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'action-btn delete-btn';
                deleteBtn.textContent = 'Delete';
                deleteBtn.onclick = () => {
                    if (confirm('Delete this message?')) {
                        socket.emit('delete_request', data.id);
                    }
                };
                actions.appendChild(deleteBtn);
            }

            div.appendChild(actions);
            chat.appendChild(div);
        }

        function appendMessageBody(div, sender, text, deleted) {
            const body = document.createElement('div');
            body.appendChild(document.createTextNode('[System.Out] '));

            const user = document.createElement('span');
            user.className = 'user';
            user.textContent = sender;
            body.appendChild(user);
            body.appendChild(document.createTextNode(': '));

            const content = document.createElement('span');
            content.className = deleted
                ? 'msg-content deleted-msg'
                : 'msg-content';
            content.textContent = '"' + text + '"';
            body.appendChild(content);

            div.appendChild(body);
        }

        function initiateReply(id, sender, text) {
            activeReplyId = id;
            activeReplyData = { sender, text };

            document.getElementById('reply-details').textContent =
                'Replying to @' + sender + ': "' +
                text.slice(0, 60) + (text.length > 60 ? '...' : '') + '"';

            document.getElementById('reply-preview-bar').style.display = 'block';
            input.focus();
        }

        function cancelReply() {
            activeReplyId = null;
            activeReplyData = null;
            document.getElementById('reply-preview-bar').style.display = 'none';
        }

        function printSystemMessage(text) {
            const div = document.createElement('div');
            div.className = 'line system';
            div.style.whiteSpace = 'pre-line';
            div.textContent = '[SYSTEM]: ' + text;
            chat.appendChild(div);
            scrollToBottom();
        }

        function scrollToBottom() {
            chat.scrollTop = chat.scrollHeight;
        }
    </script>
</body>
</html>`);
});

server.listen(PORT, () => {
    console.log('========================================');
    console.log('ADVANCED TERMINAL ONLINE ON PORT ' + PORT);
    console.log('Open http://localhost:' + PORT);
    console.log('========================================');
});
