// WebEx Meeting JavaScript
class WebExMeeting {
    constructor() {
        console.log('[WebEx] Initializing WebEx Meeting class');
        this.meetingId = null;
        this.token = null;
        this.localStream = null;
        this.screenStream = null;
        this.peerConnections = new Map();
        this.participants = new Map();
        this.isAudioEnabled = true;
        this.isVideoEnabled = true;
        this.isScreenSharing = false;
        this.meetingStartTime = null;
        this.timerInterval = null;

        this.init();
    }

    async init() {
        console.log('[WebEx] Starting initialization');
        
        // Parse URL parameters
        console.log('[WebEx] Parsing URL parameters');
        this.parseURLParameters();

        // Initialize UI elements
        console.log('[WebEx] Initializing UI elements');
        this.initializeUI();

        // Check for required parameters
        if (!this.meetingId || !this.token) {
            console.error('[WebEx] Missing required parameters - meetingId:', this.meetingId, 'token:', this.token ? 'present' : 'missing');
            this.showError('Missing meeting ID or token in URL parameters');
            return;
        }

        console.log('[WebEx] Meeting ID:', this.meetingId);
        console.log('[WebEx] Token:', this.token ? 'Token received (length: ' + this.token.length + ')' : 'No token');

        // Request permissions and initialize media
        console.log('[WebEx] Requesting permissions');
        await this.requestPermissions();
    }

    parseURLParameters() {
        console.log('[WebEx] Parsing URL:', window.location.href);
        
        // First try to get from window variables (injected by Flutter)
        if (window.WEBEX_MEETING_ID && window.WEBEX_TOKEN) {
            console.log('[WebEx] Using injected window variables');
            this.meetingId = window.WEBEX_MEETING_ID;
            this.token = window.WEBEX_TOKEN;
        } else {
            // Fallback: Try to get parameters from hash (for data URI) or search (for normal URL)
            console.log('[WebEx] Trying URL parameters as fallback');
            let urlParams;
            if (window.location.hash) {
                // Remove the # and parse as query string
                const hashParams = window.location.hash.substring(1);
                console.log('[WebEx] Found hash params:', hashParams);
                urlParams = new URLSearchParams(hashParams);
            } else {
                urlParams = new URLSearchParams(window.location.search);
            }
            
            this.meetingId = urlParams.get('meetingId');
            this.token = urlParams.get('token');
        }

        console.log('[WebEx] Extracted meetingId:', this.meetingId);
        console.log('[WebEx] Extracted token:', this.token ? '***' + this.token.slice(-4) : 'null');

        // Display meeting ID
        const meetingIdDisplay = document.getElementById('meetingIdDisplay');
        if (meetingIdDisplay && this.meetingId) {
            meetingIdDisplay.textContent = `Meeting ID: ${this.meetingId}`;
            console.log('[WebEx] Meeting ID displayed in UI');
        }
    }

    initializeUI() {
        console.log('[WebEx] Initializing UI event listeners');
        
        // Audio button
        const audioBtn = document.getElementById('audioBtn');
        if (audioBtn) {
            audioBtn.addEventListener('click', () => this.toggleAudio());
            console.log('[WebEx] Audio button listener attached');
        }

        // Video button
        const videoBtn = document.getElementById('videoBtn');
        if (videoBtn) {
            videoBtn.addEventListener('click', () => this.toggleVideo());
            console.log('[WebEx] Video button listener attached');
        }

        // Screen share button
        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.toggleScreenShare());
            console.log('[WebEx] Screen share button listener attached');
        }

        // Participants button
        const participantsBtn = document.getElementById('participantsBtn');
        if (participantsBtn) {
            participantsBtn.addEventListener('click', () => this.toggleParticipantsPanel());
            console.log('[WebEx] Participants button listener attached');
        }

        // Chat button
        const chatBtn = document.getElementById('chatBtn');
        if (chatBtn) {
            chatBtn.addEventListener('click', () => this.toggleChatPanel());
            console.log('[WebEx] Chat button listener attached');
        }

        // Leave button
        const leaveBtn = document.getElementById('leaveBtn');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', () => this.leaveMeeting());
            console.log('[WebEx] Leave button listener attached');
        }

        // Close panel buttons
        document.getElementById('closeParticipantsBtn')?.addEventListener('click', () => this.closeParticipantsPanel());
        document.getElementById('closeChatBtn')?.addEventListener('click', () => this.closeChatPanel());

        // Chat send button
        document.getElementById('sendChatBtn')?.addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chatInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });

        // Permission modal button
        document.getElementById('grantPermissionBtn')?.addEventListener('click', () => this.requestPermissions());

        // Error modal close button
        document.getElementById('errorCloseBtn')?.addEventListener('click', () => this.closeErrorModal());
        
        console.log('[WebEx] All UI event listeners initialized');
    }

    async requestPermissions() {
        console.log('[WebEx] Requesting camera and microphone permissions');
        try {
            const permissionModal = document.getElementById('permissionModal');
            permissionModal.style.display = 'none';

            // Check if getUserMedia is available
            console.log('[WebEx] Checking navigator.mediaDevices:', typeof navigator.mediaDevices);
            console.log('[WebEx] Checking getUserMedia:', typeof navigator.mediaDevices?.getUserMedia);
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.error('[WebEx] getUserMedia not supported in this WebView');
                console.log('[WebEx] This is expected on Android WebView - WebRTC is not fully supported');
                this.showError('Camera/Microphone access is not available in Android WebView. This feature works on Web platform.');
                return;
            }

            // Request camera and microphone permissions
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            };

            console.log('[WebEx] Media constraints:', JSON.stringify(constraints));
            console.log('[WebEx] Calling getUserMedia...');
            
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            console.log('[WebEx] ✓ Permissions granted successfully');
            console.log('[WebEx] Audio tracks:', this.localStream.getAudioTracks().length);
            console.log('[WebEx] Video tracks:', this.localStream.getVideoTracks().length);

            // Set local video
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
                console.log('[WebEx] Local video stream attached to video element');
            }

            // Update status indicators
            console.log('[WebEx] Updating media status indicators');
            this.updateMediaStatus();

            // Hide loading overlay
            console.log('[WebEx] Hiding loading overlay');
            this.hideLoading();

            // Start meeting timer
            console.log('[WebEx] Starting meeting timer');
            this.startMeetingTimer();

            // Initialize participants list
            console.log('[WebEx] Initializing participants list');
            this.updateParticipantsList();

            // Simulate connection (In real implementation, this would connect to WebEx API)
            console.log('[WebEx] Simulating WebEx connection');
            this.simulateConnection();

        } catch (error) {
            console.error('[WebEx] ✗ Error requesting permissions:', error);
            console.error('[WebEx] Error name:', error.name);
            console.error('[WebEx] Error message:', error.message);
            
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                console.warn('[WebEx] Permission denied by user');
                const permissionModal = document.getElementById('permissionModal');
                permissionModal.style.display = 'flex';
            } else {
                console.error('[WebEx] Unexpected error during permission request');
                this.showError('Failed to access camera or microphone: ' + error.message);
            }
        }
    }

    toggleAudio() {
        console.log('[WebEx] Toggle audio clicked');
        if (!this.localStream) {
            console.warn('[WebEx] No local stream available');
            return;
        }

        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            this.isAudioEnabled = !this.isAudioEnabled;
            audioTrack.enabled = this.isAudioEnabled;
            
            console.log('[WebEx] Audio toggled:', this.isAudioEnabled ? 'ON' : 'OFF (Muted)');
            
            const audioBtn = document.getElementById('audioBtn');
            const audioLabel = audioBtn.querySelector('.control-label');
            const audioIcon = document.getElementById('audioIcon');

            if (this.isAudioEnabled) {
                audioBtn.classList.remove('active');
                audioLabel.textContent = 'Mute';
                audioIcon.innerHTML = `
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                `;
            } else {
                audioBtn.classList.add('active');
                audioLabel.textContent = 'Unmute';
                audioIcon.innerHTML = `
                    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
                `;
            }

            this.updateMediaStatus();
            this.updateParticipantsList();
        }
    }

    toggleVideo() {
        console.log('[WebEx] Toggle video clicked');
        if (!this.localStream) {
            console.warn('[WebEx] No local stream available');
            return;
        }

        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            this.isVideoEnabled = !this.isVideoEnabled;
            videoTrack.enabled = this.isVideoEnabled;
            
            console.log('[WebEx] Video toggled:', this.isVideoEnabled ? 'ON' : 'OFF');
            
            const videoBtn = document.getElementById('videoBtn');
            const videoLabel = videoBtn.querySelector('.control-label');
            const videoIcon = document.getElementById('videoIcon');

            if (this.isVideoEnabled) {
                videoBtn.classList.remove('active');
                videoLabel.textContent = 'Stop Video';
                videoIcon.innerHTML = `
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                `;
            } else {
                videoBtn.classList.add('active');
                videoLabel.textContent = 'Start Video';
                videoIcon.innerHTML = `
                    <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
                `;
            }

            this.updateMediaStatus();
            this.updateParticipantsList();
        }
    }

    async toggleScreenShare() {
        console.log('[WebEx] Screen share toggle clicked');
        if (!this.isScreenSharing) {
            try {
                console.log('[WebEx] Starting screen share');
                
                // Request screen sharing
                const screenConstraints = {
                    video: {
                        cursor: 'always',
                        displaySurface: 'monitor'
                    },
                    audio: false
                };

                console.log('[WebEx] Requesting display media...');
                this.screenStream = await navigator.mediaDevices.getDisplayMedia(screenConstraints);
                
                console.log('[WebEx] ✓ Screen share started successfully');

                // Replace video track
                const videoTrack = this.screenStream.getVideoTracks()[0];
                const localVideo = document.getElementById('localVideo');
                
                if (localVideo) {
                    localVideo.srcObject = this.screenStream;
                }

                // Update UI
                const shareBtn = document.getElementById('shareBtn');
                shareBtn.classList.add('active');
                const shareLabel = shareBtn.querySelector('.control-label');
                shareLabel.textContent = 'Stop Sharing';

                // Show screen share indicator
                const indicator = document.getElementById('screenShareIndicator');
                indicator.style.display = 'flex';

                this.isScreenSharing = true;

                // Handle when user stops sharing via browser controls
                videoTrack.onended = () => {
                    console.log('[WebEx] Screen share stopped by user via browser controls');
                    this.stopScreenShare();
                };

            } catch (error) {
                console.error('[WebEx] ✗ Error sharing screen:', error);
                console.error('[WebEx] Error name:', error.name);
                console.error('[WebEx] Error message:', error.message);
                this.showError('Failed to share screen: ' + error.message);
            }
        } else {
            console.log('[WebEx] Stopping screen share');
            this.stopScreenShare();
        }
    }

    stopScreenShare() {
        console.log('[WebEx] Stopping screen share');
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => {
                track.stop();
                console.log('[WebEx] Screen share track stopped:', track.kind);
            });
            this.screenStream = null;
        }

        // Restore local video
        const localVideo = document.getElementById('localVideo');
        if (localVideo && this.localStream) {
            localVideo.srcObject = this.localStream;
        }

        // Update UI
        const shareBtn = document.getElementById('shareBtn');
        shareBtn.classList.remove('active');
        const shareLabel = shareBtn.querySelector('.control-label');
        shareLabel.textContent = 'Share Screen';

        // Hide screen share indicator
        const indicator = document.getElementById('screenShareIndicator');
        indicator.style.display = 'none';

        this.isScreenSharing = false;
    }

    toggleParticipantsPanel() {
        console.log('[WebEx] Toggling participants panel');
        const panel = document.getElementById('participantsPanel');
        const chatPanel = document.getElementById('chatPanel');
        
        // Close chat panel if open
        if (chatPanel.classList.contains('open')) {
            console.log('[WebEx] Closing chat panel');
            chatPanel.classList.remove('open');
        }

        const isOpening = !panel.classList.contains('open');
        panel.classList.toggle('open');
        console.log('[WebEx] Participants panel:', isOpening ? 'OPENED' : 'CLOSED');
    }

    closeParticipantsPanel() {
        console.log('[WebEx] Closing participants panel');
        const panel = document.getElementById('participantsPanel');
        panel.classList.remove('open');
    }

    toggleChatPanel() {
        console.log('[WebEx] Toggling chat panel');
        const panel = document.getElementById('chatPanel');
        const participantsPanel = document.getElementById('participantsPanel');
        
        // Close participants panel if open
        if (participantsPanel.classList.contains('open')) {
            console.log('[WebEx] Closing participants panel');
            participantsPanel.classList.remove('open');
        }

        const isOpening = !panel.classList.contains('open');
        panel.classList.toggle('open');
        console.log('[WebEx] Chat panel:', isOpening ? 'OPENED' : 'CLOSED');
    }

    closeChatPanel() {
        console.log('[WebEx] Closing chat panel');
        const panel = document.getElementById('chatPanel');
        panel.classList.remove('open');
    }

    sendChatMessage() {
        console.log('[WebEx] Send chat message clicked');
        const input = document.getElementById('chatInput');
        const message = input.value.trim();

        if (!message) {
            console.log('[WebEx] Empty message, ignoring');
            return;
        }

        console.log('[WebEx] Sending message:', message);

        // Add message to chat
        this.addChatMessage('You', message);

        // Clear input
        input.value = '';

        // In real implementation, this would send the message via WebEx API
        console.log('[WebEx] ✓ Message sent successfully');
    }

    addChatMessage(sender, message) {
        console.log('[WebEx] Adding chat message from:', sender);
        const chatMessages = document.getElementById('chatMessages');
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        
        const timestamp = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        messageElement.innerHTML = `
            <div class="sender">${this.escapeHtml(sender)}</div>
            <div class="message">${this.escapeHtml(message)}</div>
            <div class="timestamp">${timestamp}</div>
        `;

        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        console.log('[WebEx] ✓ Chat message added to UI');
    }

    updateMediaStatus() {
        console.log('[WebEx] Updating media status indicators');
        const localAudioStatus = document.getElementById('localAudioStatus');
        const localVideoStatus = document.getElementById('localVideoStatus');

        if (localAudioStatus) {
            localAudioStatus.className = `status-indicator ${this.isAudioEnabled ? 'audio-on' : 'audio-off'}`;
            localAudioStatus.title = this.isAudioEnabled ? 'Microphone On' : 'Microphone Off';
            console.log('[WebEx] Audio status indicator updated:', this.isAudioEnabled ? 'ON' : 'OFF');
        }

        if (localVideoStatus) {
            localVideoStatus.className = `status-indicator ${this.isVideoEnabled ? 'video-on' : 'video-off'}`;
            localVideoStatus.title = this.isVideoEnabled ? 'Video On' : 'Video Off';
            console.log('[WebEx] Video status indicator updated:', this.isVideoEnabled ? 'ON' : 'OFF');
        }
    }

    updateParticipantsList() {
        console.log('[WebEx] Updating participants list');
        const participantList = document.getElementById('participantList');
        const participantCount = document.getElementById('participantCount');
        const participantCountHeader = document.getElementById('participantCountHeader');

        // Add self to participants
        this.participants.set('local', {
            id: 'local',
            name: 'You',
            isAudioEnabled: this.isAudioEnabled,
            isVideoEnabled: this.isVideoEnabled,
            isLocal: true
        });

        participantList.innerHTML = '';

        console.log('[WebEx] Total participants:', this.participants.size);
        this.participants.forEach((participant) => {
            console.log('[WebEx] Adding participant to list:', participant.name);
            const participantItem = document.createElement('div');
            participantItem.className = 'participant-item';
            
            const initials = participant.name.split(' ').map(n => n[0]).join('').toUpperCase();

            participantItem.innerHTML = `
                <div class="participant-avatar">${initials}</div>
                <div class="participant-info">
                    <div class="name">${this.escapeHtml(participant.name)}</div>
                    <div class="status">${participant.isLocal ? 'Host' : 'Participant'}</div>
                </div>
                <div class="participant-badges">
                    <div class="badge ${participant.isAudioEnabled ? 'audio-on' : 'audio-off'}" title="${participant.isAudioEnabled ? 'Microphone On' : 'Muted'}">🎤</div>
                    <div class="badge ${participant.isVideoEnabled ? 'video-on' : 'video-off'}" title="${participant.isVideoEnabled ? 'Video On' : 'Video Off'}">📹</div>
                </div>
            `;

            participantList.appendChild(participantItem);
        });

        const count = this.participants.size;
        participantCount.textContent = count;
        participantCountHeader.textContent = count;
        console.log('[WebEx] ✓ Participants list updated, count:', count);
    }

    startMeetingTimer() {
        console.log('[WebEx] Starting meeting timer');
        this.meetingStartTime = Date.now();
        const timerElement = document.getElementById('meetingTimer');

        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.meetingStartTime) / 1000);
            const hours = Math.floor(elapsed / 3600);
            const minutes = Math.floor((elapsed % 3600) / 60);
            const seconds = elapsed % 60;

            const timeString = hours > 0
                ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
                : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            timerElement.textContent = timeString;
        }, 1000);
    }

    simulateConnection() {
        console.log('[WebEx] Simulating connection to WebEx servers');
        // Simulate adding remote participants (for demo purposes)
        // In real implementation, this would be handled by WebEx SDK

        setTimeout(() => {
            console.log('[WebEx] Simulating participant joining (2s delay)');
            this.addRemoteParticipant('participant1', 'John Doe', true, true);
        }, 2000);

        setTimeout(() => {
            console.log('[WebEx] Simulating another participant joining (4s delay)');
            this.addRemoteParticipant('participant2', 'Jane Smith', true, false);
        }, 4000);

        setTimeout(() => {
            console.log('[WebEx] Simulating incoming chat message (5s delay)');
            this.addChatMessage('John Doe', 'Hello everyone!');
        }, 5000);
    }

    addRemoteParticipant(id, name, isAudioEnabled, isVideoEnabled) {
        console.log('[WebEx] Adding remote participant:', name, 'ID:', id);
        
        // Add to participants map
        this.participants.set(id, {
            id,
            name,
            isAudioEnabled,
            isVideoEnabled,
            isLocal: false
        });
        
        console.log('[WebEx] Participant added to map');

        // Create video element
        const remoteVideos = document.getElementById('remoteVideos');
        const videoContainer = document.createElement('div');
        videoContainer.className = 'remote-video-container';
        videoContainer.id = `remote-${id}`;

        videoContainer.innerHTML = `
            <video autoplay playsinline></video>
            <div class="video-overlay">
                <span class="participant-name">${this.escapeHtml(name)}</span>
                <div class="video-status">
                    <span class="status-indicator ${isAudioEnabled ? 'audio-on' : 'audio-off'}"></span>
                    <span class="status-indicator ${isVideoEnabled ? 'video-on' : 'video-off'}"></span>
                </div>
            </div>
        `;

        remoteVideos.appendChild(videoContainer);
        console.log('[WebEx] ✓ Remote participant video container added to DOM');

        // Update participants list
        this.updateParticipantsList();
    }

    removeRemoteParticipant(id) {
        console.log('[WebEx] Removing remote participant:', id);
        this.participants.delete(id);
        
        const videoContainer = document.getElementById(`remote-${id}`);
        if (videoContainer) {
            videoContainer.remove();
            console.log('[WebEx] ✓ Participant video container removed');
        }

        this.updateParticipantsList();
    }

    async leaveMeeting() {
        console.log('[WebEx] Leave meeting initiated');
        
        // Stop all tracks
        if (this.localStream) {
            console.log('[WebEx] Stopping local media tracks');
            this.localStream.getTracks().forEach(track => {
                track.stop();
                console.log('[WebEx] Stopped track:', track.kind);
            });
        }

        if (this.screenStream) {
            console.log('[WebEx] Stopping screen share tracks');
            this.screenStream.getTracks().forEach(track => {
                track.stop();
                console.log('[WebEx] Stopped screen share track:', track.kind);
            });
        }

        // Clear timer
        if (this.timerInterval) {
            console.log('[WebEx] Clearing meeting timer');
            clearInterval(this.timerInterval);
        }

        // Close all peer connections
        console.log('[WebEx] Closing peer connections, count:', this.peerConnections.size);
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();

        // Show goodbye message
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.classList.remove('hidden');
        loadingOverlay.innerHTML = `
            <div class="spinner"></div>
            <p>You have left the meeting</p>
        `;

        // In real implementation, this would disconnect from WebEx API
        console.log('[WebEx] ✓ Left meeting successfully');

        // Close window after delay (or redirect)
        console.log('[WebEx] Window will close in 2 seconds');
        setTimeout(() => {
            window.close();
        }, 2000);
    }

    showError(message) {
        console.error('[WebEx] Showing error modal:', message);
        const errorModal = document.getElementById('errorModal');
        const errorMessage = document.getElementById('errorMessage');
        
        errorMessage.textContent = message;
        errorModal.style.display = 'flex';
        
        this.hideLoading();
    }

    closeErrorModal() {
        console.log('[WebEx] Closing error modal');
        const errorModal = document.getElementById('errorModal');
        errorModal.style.display = 'none';
    }

    hideLoading() {
        console.log('[WebEx] Hiding loading overlay');
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.classList.add('hidden');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the meeting when DOM is ready
console.log('[WebEx] Document ready state:', document.readyState);
if (document.readyState === 'loading') {
    console.log('[WebEx] Waiting for DOM to load');
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[WebEx] DOM loaded, initializing WebEx Meeting');
        new WebExMeeting();
    });
} else {
    console.log('[WebEx] DOM already loaded, initializing WebEx Meeting');
    new WebExMeeting();
}

// Handle visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log('[WebEx] Page is now hidden');
    } else {
        console.log('[WebEx] Page is now visible');
    }
});

// Handle before unload
window.addEventListener('beforeunload', (e) => {
    // Cleanup
    console.log('[WebEx] Page unloading - cleanup initiated');
});

console.log('[WebEx] JavaScript loaded successfully');
