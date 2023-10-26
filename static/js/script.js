const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
// text message elements
let assitantDiv = null;
let messagesCompleted = false;
chatMessages.style.display = 'none';

// audio elements
const audioElement = document.getElementById('audioElement');
let audioContext = new (window.AudioContext || window.webkitAudioContext)();
const source = audioContext.createBufferSource();
const gainNode = audioContext.createGain();


source.connect(gainNode);
gainNode.connect(audioContext.destination);

// inital variables
let audioBufferQueue = []; // Queue to store audio buffers
let isPlaying = false;
let isFinalPacketReceived = false;
let totalPackets = 0;
let packetsPlayed = 0;
let currentTime = audioContext.currentTime;

//////////////////////////

const codec = 'audio/mpeg'
const maxBufferDuration = 60 // Maximum buffer duration in seconds
const maxConcurrentRequests = 3
const mediaSource = new MediaSource()
const audioEle = new Audio()
let sourceBuffer;
let isAppending = false
let appendQueue = []
source.connect(gainNode);
gainNode.connect(audioContext.destination);
let gameProgress = 0;

var unmuteIcon = '▶️ Play Audio'
var muteIcon = '⏸ Pause Audio'
var audioToggle = document.getElementById("audio_toggle");





function toggleMute() {
    console.log('toggleMute')
    audioEle.muted = !audioEle.muted;
    audioEle.play();
    console.log(audioEle.muted)
    // if the video is muted, set the btn.innerHTML to unmuteIcon
    // otherwise, set it to the muteIcon
    if (audioEle.muted) {
        audioToggle.innerHTML = unmuteIcon;
    } else {
        audioToggle.innerHTML = muteIcon;
    }
}

function appendChunk(chunk) {
    appendQueue.push(chunk)
    processAppendQueue()
    audioEle.volume = 1
    while (mediaSource.duration - mediaSource.currentTime > maxBufferDuration) {
        audioEle.volume = 1
        const removeEnd = mediaSource.currentTime - maxBufferDuration
        sourceBuffer.remove(0, removeEnd)
    }
}
function processAppendQueue() {
    if (!isAppending && appendQueue.length > 0) {
        isAppending = true
        const chunk = appendQueue.shift()
        chunk && sourceBuffer.appendBuffer(chunk)
    }
}
mediaSource.addEventListener('sourceopen', () => {
    sourceBuffer = mediaSource.addSourceBuffer(codec) // Adjust the MIME type accordingly
    isAppending = false
    appendQueue = []
    audioEle.volume = 1
    sourceBuffer.addEventListener('updateend', () => {
        isAppending = false
        processAppendQueue()
    })
});
const socket = io.connect(
    'http://' + document.domain + ':' + location.port
);

socket.on('connect', function () {
    console.log('Connected to server');
});
printingTimer = setInterval(function () {
    audioEle.volume = 1
}, 1);
socket.on('assistant_reply', function (data) {

    const serializedData = JSON.parse(data);
    console.log('Serialized data: ' + serializedData);
    if (!serializedData.completed) {
        if (serializedData.reply) {
            console.log(serializedData, 'display')
            if (!assitantDiv) {
                // Create a new div for assistant messages
                assitantDiv = createMessageDiv('assistant');
            }

            // Display the message

            displayMessage(serializedData.reply, assitantDiv);
        }
    } else {
        messagesCompleted = true;
        assitantDiv = null;
    }
    if (serializedData.audio) {
        const audioBase64 = serializedData.audio;
        const audioBufferArray = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
        audioEle.volume = 1

        appendChunk(audioBufferArray.buffer);
        // audioContext.decodeAudioData(audioBufferArray.buffer, (buffer) => {
        //     audioBufferQueue.push({ buffer: buffer });
        //     totalPackets++;
        //     console.log(totalPackets, 'total packets received')
        //     if (!isPlaying) {
        //         bufferAudioChunks();
        //     }
        // });
    }

});

audioEle.src = URL.createObjectURL(mediaSource);
audioEle.muted = true;
sendButton.addEventListener('click', sendMessage);

function sendMessage() {

    audioEle.play()
    const userMessage = userInput.value;
    if (userMessage.trim() === '') return;


    const userDiv = createMessageDiv('user');
    displayMessage(userMessage, userDiv);
    socket.emit('user_message', { content: userMessage });

    userInput.value = '';
}
function createMessageDiv(sender) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);
    chatMessages.appendChild(messageDiv);
    return messageDiv;
}
function displayMessage(message, div) {
    const textNode = document.createTextNode(message);
    // let messageElement = div.lastChild;
    // if (!messageElement || messageElement.tagName !== 'p') {
    //     messageElement = document.createElement('p');
    //     div.appendChild(messageElement);
    // }
    div.appendChild(textNode);
    // messageElement.textContent += ' ' + message;
    chatMessages.scrollTop = chatMessages.scrollHeight;
    const hasChildElements = chatMessages.hasChildNodes();
    chatMessages.style.display = hasChildElements ? 'block' : 'none';
}
userInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendButton.click();
    }
});



async function bufferAudioChunks() {
    console.log('total packets received', totalPackets, 'packets played', packetsPlayed);
    if (audioBufferQueue.length > 0) {
        const { buffer } = audioBufferQueue.shift();

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);

        packetsPlayed++;
        source.start(currentTime);

        currentTime += buffer.duration;

        source.onended = async () => {
            if (audioBufferQueue.length > 0) {
                bufferAudioChunks();
            } else if (packetsPlayed === totalPackets) {
                stopPlayback();
            }
        };
        isPlaying = true;
    }
}


function stopPlayback() {
    audioBufferQueue = [];
    isPlaying = false;
}
