// chat.js
import { online } from './peermesh.js';
import { nodeSettings } from './nodeManager.js';
import { getUserNodeActor } from './khet.js';
import { user } from './user.js';

export const chat = {
    messages: [],
    messageListeners: [],

    onMessage(callback) {
        this.messageListeners.push(callback);
    },

    async sendMessage(text) {
        const message = {
            sender: user.getUserPrincipal() || 'Anonymous',
            text,
            timestamp: Date.now()
        };

        if (nodeSettings.nodeType === 0 || nodeSettings.nodeType === 1) {
            // P2P Mode
            online.send('chat', message);
        } else {
            // Canister Mode
            const actor = await getUserNodeActor();
            await actor.sendChatMessage(message);
        }

        this.messages.push(message);
        this.notifyListeners(message);
    },

    receiveMessage(message) {
        this.messages.push(message);
        this.notifyListeners(message);
    },

    notifyListeners(message) {
        this.messageListeners.forEach(callback => callback(message));
    },

    async getMessageHistory() {
        if (nodeSettings.nodeType === 2 || nodeSettings.nodeType === 3) {
            const actor = await getUserNodeActor();
            const history = await actor.getChatHistory();
            this.messages = history;
            return history;
        }
        return [];
    }
};

export function initChat() {
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');

    // Set up onMessage listener for displaying
    chat.onMessage((message) => {
        const messageElement = document.createElement('div');
        messageElement.textContent = `[${new Date(message.timestamp).toLocaleTimeString()}] ${message.sender}: ${message.text}`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // Send on button click
    sendChatBtn.addEventListener('click', async () => {
        const text = chatInput.value.trim();
        if (text) {
            await chat.sendMessage(text);
            chatInput.value = '';
        }
    });

    // Send on Enter
    chatInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const text = chatInput.value.trim();
            if (text) {
                await chat.sendMessage(text);
                chatInput.value = '';
            }
        }
    });

    // Fetch history for canister mode
    if (nodeSettings.nodeType === 2 || nodeSettings.nodeType === 3) {
        chat.getMessageHistory().then(history => {
            history.forEach(message => {
                const messageElement = document.createElement('div');
                messageElement.textContent = `[${new Date(message.timestamp).toLocaleTimeString()}] ${message.sender}: ${message.text}`;
                chatMessages.appendChild(messageElement);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    }
}