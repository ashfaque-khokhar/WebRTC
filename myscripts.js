
// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new PeerApp();
});
// Main application class
class PeerApp {
    constructor() {
        // DOM elements
        this.elements = {
            startCallButton: document.getElementById('startCallButton'),
            endCallButton: document.getElementById('endCallButton'),
            localVideo: document.getElementById('localVideo'),
            remoteVideo: document.getElementById('remoteVideo'),
            remoteVideoContainer: document.getElementById('remoteVideoContainer'),
            videosContainer: document.getElementById('videosContainer'),
            myPeerIdSpan: document.getElementById('myPeerId'),
            copyPeerIdBtn: document.getElementById('copyPeerId'),
            peerIdInput: document.getElementById('peerIdInput'),
            toggleAudioButton: document.getElementById('toggleAudioButton'),
            toggleVideoButton: document.getElementById('toggleVideoButton'),

            callInit: document.getElementById('callInit'),
            callOptionsModal: document.getElementById('callOptionsModal'),
            optionChat: document.getElementById('optionChat'),
            optionVideo: document.getElementById('optionVideo'),
            chatContainer: document.getElementById('chatContainer'),
            chatMessages: document.getElementById('chatMessages'),
            chatInput: document.getElementById('chatInput'),
            sendChatButton: document.getElementById('sendChatButton'),
            incomingCallModal: document.getElementById('incomingCallModal'),
            incomingCallType: document.getElementById('incomingCallType'),
            acceptCallBtn: document.getElementById('acceptCallBtn'),
            rejectCallBtn: document.getElementById('rejectCallBtn'),
            connectedPeersSpan: document.getElementById('connectedPeers'),
            disconnectBtn: document.getElementById('disconnectBtn'),
            chatInputContainer: document.querySelector('.chat-input-container'),
            newPeerId: document.getElementById('newPeerId'),
            typingIndicator: document.getElementById('typingIndicator'),
            connectionStatus: document.getElementById('connectionStatus'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText')
        };

        // App state
        this.state = {
            myPeerId: generateRandomPeerId(),
            localStream: null,
            peerConnection: null,
            audioEnabled: true,
            videoEnabled: false,
            connectedPeers: [],
            pendingCall: null,
            currentChatConn: null,
            typingTimeout: null,
            messageCounter: 0,
            pendingMessages: new Map(),
            deliveryTimeouts: new Map(),
            pingInterval: null,
            pongTimeout: null,
            lastPongReceived: null
        };

        this.init();
    }

    init() {
        // Initialize PeerJS
        this.peer = new Peer(this.state.myPeerId);
        console.log('[PeerJS] Peer instance created with ID:', this.state.myPeerId);

        // Set initial UI state
        this.elements.myPeerIdSpan.textContent = this.state.myPeerId;
        this.setConnectedUI(false);

        // Request initial audio stream
        this.getUserMedia({ video: true, audio: true })
            .then(stream => this.setLocalStream(stream))
            .catch(error => console.error('[Media] Error accessing media devices.', error));

        // Set up event listeners
        this.setupEventListeners();
    }

    // Media handling
    async getUserMedia(constraints) {
        try {
            return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error) {
            console.error('[Media] Error getting user media:', error);
            throw error;
        }
    }

    setLocalStream(stream) {
        this.state.localStream = stream;
        this.elements.localVideo.srcObject = stream;
        console.log('[Media] Stream obtained and assigned to localVideo.');
    }

    // Connection management
    updateConnectedPeers(peerId, add) {
        if (add) {
            if (!this.state.connectedPeers.includes(peerId)) {
                this.state.connectedPeers.push(peerId);
            }
        } else {
            this.state.connectedPeers = this.state.connectedPeers.filter(id => id !== peerId);
        }

        this.elements.connectedPeersSpan.textContent = this.state.connectedPeers.length
            ? `Connected Peers: ${this.state.connectedPeers.join(', ')}`
            : 'Connected Peers: None';
    }

    // UI state management
    setCallUIActive(active) {
        this.elements.startCallButton.disabled = active;
        this.elements.peerIdInput.disabled = active;

        if (active) {
            this.elements.startCallButton.classList.add('disabled');
            this.elements.peerIdInput.classList.add('disabled');
            this.elements.callInit.classList.add('hide');
        } else {
            this.elements.startCallButton.classList.remove('disabled');
            this.elements.peerIdInput.classList.remove('disabled');
            this.elements.callInit.classList.remove('hide');
        }
    }

    setConnectedUI(connected) {
        this.elements.disconnectBtn.style.display = connected ? '' : 'none';
        this.elements.chatInputContainer.style.display = connected ? '' : 'none';

        this.elements.endCallButton.style.display = connected ? '' : 'none';
    }

    // Call handling
    async startCall(peerId, type) {
        try {
            this.setCallUIActive(true);
            this.elements.videosContainer.classList.add('active');
            this.elements.endCallButton.classList.add('active');


            let constraints = { video:true,audio: true };
          
            const stream = await this.getUserMedia(constraints);
            this.setLocalStream(stream);

            const call = this.peer.call(peerId, stream);
            this.state.peerConnection = call;
            this.updateConnectedPeers(peerId, true);

            call.on('stream', remoteStream => {
                this.elements.remoteVideo.srcObject = remoteStream;
                this.elements.remoteVideoContainer.classList.add('active');
            });

            call.on('close', () => this.endCall());

            this.setConnectedUI(true);
            return call;
        } catch (error) {
            console.error('[Call] Error starting call:', error);
            this.endCall();
            throw error;
        }
    }

    async answerCall() {
        if (!this.state.pendingCall) return;

        try {
            this.elements.incomingCallModal.classList.remove('active');
            this.setCallUIActive(true);
            this.elements.videosContainer.classList.add('active');
            this.elements.endCallButton.classList.add('active');

            // Ensure we have the required media
            const currentStream = this.state.localStream;
            if (!currentStream || (this.state.pendingCall.metadata?.type === 'video' && !currentStream.getVideoTracks().length)) {
                const constraints = {
                    audio: true,
                    video: this.state.pendingCall.metadata?.type === 'video'
                };
                const stream = await this.getUserMedia(constraints);
                this.setLocalStream(stream);
            }

            this.state.pendingCall.answer(this.state.localStream);
            this.state.peerConnection = this.state.pendingCall;
            this.updateConnectedPeers(this.state.pendingCall.peer, true);

            this.state.pendingCall.on('stream', remoteStream => {
                this.elements.remoteVideo.srcObject = remoteStream;
                this.elements.remoteVideoContainer.classList.add('active');

            });

            this.state.pendingCall.on('close', () => this.endCall());

            this.setConnectedUI(true);
            this.state.pendingCall = null;
        } catch (error) {
            console.error('[Call] Error answering call:', error);
            this.endCall();
        }
    }

    endCall() {
        if (this.state.peerConnection) {
            this.state.peerConnection.close();
            this.state.peerConnection = null;
        }

        if (this.state.currentChatConn) {
            this.state.currentChatConn.close();
            this.state.currentChatConn = null;
        }

        this.elements.remoteVideo.srcObject = null;
        this.elements.remoteVideoContainer.classList.remove('active');

        this.elements.videosContainer.classList.remove('active');
        this.elements.endCallButton.classList.remove('active');
        this.elements.chatContainer.classList.remove('active');
        this.setCallUIActive(false);
        this.setConnectedUI(false);

        // Reset peer list but keep UI responsive
        this.state.connectedPeers = [];
        this.elements.connectedPeersSpan.textContent = 'Connected Peers: None';

          refreshPage() ;
    }

    // Chat handling
    setupChatConnection(peerId) {
        const conn = this.peer.connect(peerId);
        this.state.currentChatConn = conn;
        this.updateConnectedPeers(peerId, true);

        conn.on('open', () => {
            console.log('[Chat] Data connection opened.');
            console.log('User is online and connected');
            this.setConnectedUI(true);
            this.startHeartbeat();
        });

        conn.on('data', data => {
            if (data.type === 'typing') {
                console.log('User is typing...');
                this.showTypingIndicator();
            } else if (data.type === 'message') {
                const decodedMsg = decodeBase64(data.text);
                this.appendChatMessage('Peer', decodedMsg, data.id);
                
                conn.send({
                    type: 'delivered',
                    id: data.id
                });
            } else if (data.type === 'delivered') {
                console.log('Message delivered');
                this.updateMessageDeliveryStatus(data.id);
            } else if (data.type === 'ping') {
                conn.send({ type: 'pong' });
            } else if (data.type === 'pong') {
                this.handlePongReceived();
            } else {
                const decodedMsg = decodeBase64(data);
                this.appendChatMessage('Peer', decodedMsg);
            }
        });

        conn.on('close', () => {
            console.log('User disconnected');
            this.stopHeartbeat();
            this.appendChatMessage('System', 'Chat ended.');
            this.updateConnectedPeers(peerId, false);
            this.setConnectedUI(false);
            refreshPage();
        });

        conn.on('error', (err) => {
            console.log('Connection error', err);
        });
    }
    appendChatMessage(sender, message, messageId = null) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message');
        
        if (messageId) {
            msgDiv.dataset.messageId = messageId;
        }

        if (sender === 'You') {
            msgDiv.classList.add('outgoing');
        } else if (sender === 'Peer') {
            msgDiv.classList.add('incoming');
        } else if (sender === 'System') {
            msgDiv.style.textAlign = 'center';
            msgDiv.style.color = '#888';
        }

        const messageContent = document.createElement('div');
        messageContent.textContent = message;

        const metadata = document.createElement('span');
        metadata.classList.add('metadata');

        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        if (sender === 'You') {
            metadata.innerHTML = `${timeString} <span class="ticks">✔</span>`;
        }
        if (sender === 'Peer')
        {
            metadata.innerHTML = `${timeString}`;
        }

        msgDiv.appendChild(messageContent);
        if (sender === 'You' || sender === 'Peer') {
            msgDiv.appendChild(metadata);
        }

        this.elements.chatMessages.appendChild(msgDiv);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;

        if (sender === 'System' && message === 'Chat ended.') {
            this.elements.chatContainer.classList.remove('active');
            this.setCallUIActive(false);
        }
    }


    sendChatMessage() {
        const msg = this.elements.chatInput.value.trim();
        if (!msg || !this.state.currentChatConn) return;

        const messageId = `msg_${Date.now()}_${this.state.messageCounter++}`;
        
        this.state.currentChatConn.send({
            type: 'message',
            id: messageId,
            text: encodeBase64(msg)
        });
        
        this.appendChatMessage('You', msg, messageId);
        this.state.pendingMessages.set(messageId, msg);
        
        const timeout = setTimeout(() => {
            if (this.state.pendingMessages.has(messageId)) {
                this.markMessageAsNotDelivered(messageId);
                this.appendChatMessage('System', 'Message not delivered - Disconnected');
            }
        }, 5000);
        
        this.state.deliveryTimeouts.set(messageId, timeout);
        this.elements.chatInput.value = '';
    }

    updateMessageDeliveryStatus(messageId) {
        const messageDiv = this.elements.chatMessages.querySelector(`[data-message-id="${messageId}"]`);
        if (messageDiv) {
            const ticksSpan = messageDiv.querySelector('.ticks');
            if (ticksSpan) {
                ticksSpan.innerHTML = '✔✔';
            }
        }
        
        if (this.state.deliveryTimeouts.has(messageId)) {
            clearTimeout(this.state.deliveryTimeouts.get(messageId));
            this.state.deliveryTimeouts.delete(messageId);
        }
        
        this.state.pendingMessages.delete(messageId);
    }

    markMessageAsNotDelivered(messageId) {
        const messageDiv = this.elements.chatMessages.querySelector(`[data-message-id="${messageId}"]`);
        if (messageDiv) {
            const ticksSpan = messageDiv.querySelector('.ticks');
            if (ticksSpan) {
                ticksSpan.innerHTML = '⚠️';
                ticksSpan.style.color = '#ff4444';
            }
        }
        
        if (this.state.deliveryTimeouts.has(messageId)) {
            clearTimeout(this.state.deliveryTimeouts.get(messageId));
            this.state.deliveryTimeouts.delete(messageId);
        }
        
        this.state.pendingMessages.delete(messageId);
    }

    showTypingIndicator() {
        this.elements.typingIndicator.style.display = 'block';
        
        if (this.state.typingTimeout) {
            clearTimeout(this.state.typingTimeout);
        }
        
        this.state.typingTimeout = setTimeout(() => {
            this.elements.typingIndicator.style.display = 'none';
        }, 2000);
    }

    sendTypingIndicator() {
        if (this.state.currentChatConn && this.state.currentChatConn.open) {
            this.state.currentChatConn.send({
                type: 'typing',
                user: this.state.myPeerId
            });
        }
    }

    startHeartbeat() {
        this.updateConnectionStatus('online');
        this.state.lastPongReceived = Date.now();
        
        this.state.pingInterval = setInterval(() => {
            if (this.state.currentChatConn && this.state.currentChatConn.open) {
                this.state.currentChatConn.send({ type: 'ping' });
                
                this.state.pongTimeout = setTimeout(() => {
                    const timeSinceLastPong = Date.now() - this.state.lastPongReceived;
                    if (timeSinceLastPong > 10000) {
                        console.log('Connection lost - no pong received');
                        this.updateConnectionStatus('offline');
                        this.appendChatMessage('System', 'Connection lost - User appears offline');
                    }
                }, 10000);
            }
        }, 5000);
    }

    stopHeartbeat() {
        if (this.state.pingInterval) {
            clearInterval(this.state.pingInterval);
            this.state.pingInterval = null;
        }
        if (this.state.pongTimeout) {
            clearTimeout(this.state.pongTimeout);
            this.state.pongTimeout = null;
        }
        this.updateConnectionStatus('offline');
    }

    handlePongReceived() {
        this.state.lastPongReceived = Date.now();
        if (this.state.pongTimeout) {
            clearTimeout(this.state.pongTimeout);
        }
        this.updateConnectionStatus('online');
    }

    updateConnectionStatus(status) {
        this.elements.connectionStatus.style.display = 'flex';
        
        if (status === 'online') {
            this.elements.statusIndicator.className = 'status-indicator online';
            this.elements.statusText.textContent = 'Online';
        } else {
            this.elements.statusIndicator.className = 'status-indicator offline';
            this.elements.statusText.textContent = 'Offline';
        }
    }


    // Media controls
    toggleAudio() {
        if (!this.state.localStream) return;

        this.state.audioEnabled = !this.state.audioEnabled;
        this.state.localStream.getAudioTracks().forEach(track => {
            track.enabled = this.state.audioEnabled;
        });
         // Toggle icon in the button
    const icon = this.elements.toggleAudioButton.querySelector("i");
    if (this.state.audioEnabled) {
        icon.classList.remove("fa-microphone-slash");
        icon.classList.add("fa-microphone");
    } else {
        icon.classList.remove("fa-microphone");
        icon.classList.add("fa-microphone-slash");
    }

       // this.elements.toggleAudioButton.textContent = this.state.audioEnabled ? '🔊 Audio On' : '🔇 Audio Off';
        console.log('[UI] Audio', this.state.audioEnabled ? 'enabled' : 'muted');
    }

    async toggleVideo() {
        if (!this.state.localStream) return;

        try {
            const icon = this.elements.toggleVideoButton.querySelector("i");

            if (!this.state.videoEnabled) {
                // Enable video
                const videoStream = await this.getUserMedia({ video: true });
                const videoTrack = videoStream.getVideoTracks()[0];

                // Add the video track to the local stream
                this.state.localStream.addTrack(videoTrack);
                this.elements.localVideo.srcObject = this.state.localStream;

                // Add the video track to the peer connection
                if (this.state.peerConnection) {
                    const sender = this.state.peerConnection.peerConnection
                        .getSenders()
                        .find(s => s.track && s.track.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(videoTrack);
                    } else {
                        this.state.peerConnection.peerConnection.addTrack(videoTrack, this.state.localStream);
                    }
                }

                this.state.videoEnabled = true;
                icon.classList.remove("fa-video-slash");
                icon.classList.add("fa-video");
            } else {
                // Disable video
                this.state.localStream.getVideoTracks().forEach(track => {
                    track.stop();
                    this.state.localStream.removeTrack(track);
                });
                this.elements.localVideo.srcObject = this.state.localStream;

                // Remove the video track from the peer connection
                if (this.state.peerConnection) {
                    const sender = this.state.peerConnection.peerConnection
                        .getSenders()
                        .find(s => s.track && s.track.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(null);
                    }
                }

                this.state.videoEnabled = false;
                icon.classList.remove("fa-video");
                icon.classList.add("fa-video-slash");
            }
        } catch (error) {
            console.error('[Media] Error toggling video:', error);
        }
    }

    async toggleVideo1() {
        if (!this.state.localStream) return;

        try {
             // Toggle icon in the button
    const icon = this.elements.toggleVideoButton.querySelector("i");
            if (!this.state.videoEnabled) {
                const videoStream = await this.getUserMedia({ video: true });
                const videoTrack = videoStream.getVideoTracks()[0];
                this.state.localStream.addTrack(videoTrack);
                this.elements.localVideo.srcObject = this.state.localStream;
                this.state.videoEnabled = true;
                icon.classList.remove("fa-video-slash");
                icon.classList.add("fa-video");

            } else {
                this.state.localStream.getVideoTracks().forEach(track => {
                    track.stop();
                    this.state.localStream.removeTrack(track);
                });
                this.elements.localVideo.srcObject = this.state.localStream;
                this.state.videoEnabled = false;

                icon.classList.remove("fa-video");
                icon.classList.add("fa-video-slash");
            }
        } catch (error) {
            console.error('[Media] Error toggling video:', error);
        }
    }

    // Event listeners
    setupEventListeners() {
        // PeerJS events
        this.peer.on('call', call => {
            console.log('[PeerJS] Incoming call received.');
            this.state.pendingCall = call;

            let type = 'Audio/Video Call';
            if (call.metadata?.type) {
                type = `${call.metadata.type.charAt(0).toUpperCase()}${call.metadata.type.slice(1)} Call`;
            }

            this.elements.incomingCallType.textContent = type;
            this.elements.incomingCallModal.classList.add('active');

            call.on('close', () => {
                this.updateConnectedPeers(call.peer, false);
                this.setConnectedUI(false);
            });
        });

        this.peer.on('connection', conn => {
            this.state.currentChatConn = conn;
            this.elements.chatContainer.classList.add('active');
            this.setCallUIActive(true);
            this.elements.endCallButton.classList.add('active');
            this.updateConnectedPeers(conn.peer, true);
            this.setConnectedUI(true);

            conn.on('open', () => {
                console.log('User is online and connected');
                this.startHeartbeat();
            });

            conn.on('data', data => {
                if (data.type === 'typing') {
                    console.log('User is typing...');
                    this.showTypingIndicator();
                } else if (data.type === 'message') {
                    const decodedMsg = decodeBase64(data.text);
                    this.appendChatMessage('Peer', decodedMsg, data.id);
                    
                    conn.send({
                        type: 'delivered',
                        id: data.id
                    });
                } else if (data.type === 'delivered') {
                    console.log('Message delivered');
                    this.updateMessageDeliveryStatus(data.id);
                } else if (data.type === 'ping') {
                    conn.send({ type: 'pong' });
                } else if (data.type === 'pong') {
                    this.handlePongReceived();
                } else {
                    const decodedMsg = decodeBase64(data);
                    this.appendChatMessage('Peer', decodedMsg);
                }
            });

            conn.on('close', () => {
                console.log('User disconnected');
                this.stopHeartbeat();
                this.appendChatMessage('System', 'Chat ended.');
                this.updateConnectedPeers(conn.peer, false);
                this.setConnectedUI(false);
            });

            conn.on('error', (err) => {
                console.log('Connection error', err);
            });
        });

        // Button events
        this.elements.startCallButton.addEventListener('click', () => {
            const peerId = this.elements.peerIdInput.value.trim();
            if (!peerId) {
                this.elements.peerIdInput.focus();
                return;
            }
            this.elements.callOptionsModal.dataset.peerId = peerId;
            this.elements.callOptionsModal.classList.add('active');
        });

        this.elements.endCallButton.addEventListener('click', () => this.endCall());
        this.elements.disconnectBtn.addEventListener('click', () => this.endCall());

        this.elements.acceptCallBtn.addEventListener('click', () => this.answerCall());
        this.elements.rejectCallBtn.addEventListener('click', () => {
            if (this.state.pendingCall) {
                try { this.state.pendingCall.close(); } catch (e) {}
                this.state.pendingCall = null;
            }
            this.elements.incomingCallModal.classList.remove('active');
        });

        // Call options
        this.elements.optionChat.addEventListener('click', () => {
            const peerId = this.elements.callOptionsModal.dataset.peerId;
            this.elements.callOptionsModal.classList.remove('active');
            this.setCallUIActive(true);
            this.elements.chatContainer.classList.add('active');
            this.elements.endCallButton.classList.add('active');
            this.elements.videosContainer.classList.remove('active');

            this.setupChatConnection(peerId);
        });


        this.elements.optionVideo.addEventListener('click', () => {
            const peerId = this.elements.callOptionsModal.dataset.peerId;
            this.elements.callOptionsModal.classList.remove('active');
            this.startCall(peerId, 'video');
        });

        // Chat events
        this.elements.sendChatButton.addEventListener('click', () => this.sendChatMessage());
        this.elements.chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            } else {
                this.sendTypingIndicator();
            }
        });

        // Media controls
        this.elements.toggleAudioButton.addEventListener('click', () => this.toggleAudio());
        this.elements.toggleVideoButton.addEventListener('click', () => this.toggleVideo());

        // Peer ID management
        this.elements.copyPeerIdBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(this.state.myPeerId)
                .then(() => {
                    this.elements.copyPeerIdBtn.textContent = '✅';
                    setTimeout(() => {
                        this.elements.copyPeerIdBtn.textContent = '📋';
                    }, 1000);
                })
                .catch(err => console.error('[UI] Error copying Peer ID:', err));
        });

        this.elements.newPeerId.addEventListener('click', () => {
         refreshPage() ;
        });
    }
}

function refreshPage() {
    location.reload();
  }

  // Utility functions
  function generateRandomPeerId() {
      return Math.floor(1000 + Math.random() * 9000).toString();
  }

  function showToast(message, duration = 2000) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.style.opacity = '1';
      setTimeout(() => {
          toast.style.opacity = '0';
      }, duration);
  }

let value = "";
  
  function encodeBase64(text) {
    if (typeof text !== 'string') {
        console.error('[Base64] Input must be a string');
        return '';
    }

    try {
        const encodedText = encodeURIComponent(text);
        const escapedText = unescape(encodedText);
        const base64Value = btoa(escapedText);
        
        console.log(`Base64 encoded: "${text}" => "${base64Value}"`);
        return base64Value;
    } catch (error) {
        console.error('[Base64] Encoding error:', error.message);
        return '';
    }
}

function decodeBase64(base64String) {
    if (typeof base64String !== 'string') {
        console.error('[Base64] Input must be a string');
        return '[Invalid Base64 Input]';
    }

    try {
        
        const binaryString = atob(base64String);
        const escapedString = escape(binaryString);
        const decodedString = decodeURIComponent(escapedString);
        
        console.log(`Base64 decoded: "${base64String}" => "${decodedString}"`);
        return decodedString;
    } catch (error) {
        console.error('[Base64] Decoding error:', error.message);
        return '[Invalid Base64 Data]';
    }
}



