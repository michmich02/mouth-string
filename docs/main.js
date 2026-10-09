import { SpeechManager } from './speech.js?v=16';
import { PhysicsSystem } from './physics.js?v=16';
import { Tracker } from './tracker.js?v=16';
import { Renderer } from './renderer.js?v=16';

let video, canvas;
let speech, physics, tracker, renderer;
let isPlaying = false;
let lastVideoTime = -1;

window.onerror = function(msg, url, lineNo, columnNo, error) {
    alert("Error: " + msg + "\nLine: " + lineNo + "\n" + (error ? error.stack : ''));
    return false;
};

// Also catch unhandled promise rejections
window.addEventListener('unhandledrejection', function(event) {
    alert("Promise Error: " + event.reason);
});

async function init() {
    const startBtn = document.getElementById('start-btn');
    startBtn.addEventListener('click', startExperience);

    video = document.getElementById('webcam');
    canvas = document.getElementById('output-canvas');

    // Handle resize
    window.addEventListener('resize', onResize);

    // Handle manual typing
    const wordInput = document.getElementById('word-input');
    wordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && wordInput.value.trim() !== '') {
            const word = wordInput.value.trim();
            
            // Add to speech manager so it can be pulled by the ribbon later
            if (speech) {
                speech.addWord(word);
            }

            // Removed explosion, text is only used for string pulling

            wordInput.value = ''; // clear input
        }
    });
}

async function startExperience() {
    document.getElementById('ui-overlay').classList.add('hidden');
    
    // 1. Setup Webcam
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: true
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
        };
    } catch (err) {
        alert("Microphone and Camera access is required for this artwork.");
        return;
    }

    // 2. Setup Modules
    speech = new SpeechManager();
    physics = new PhysicsSystem();
    tracker = new Tracker();
    renderer = new Renderer(canvas, physics);

    onResize(); // Set initial canvas size

    // When speaking, add to auto-flow queue. 
    // Reverse the word so it reads correctly from Mouth to Hand!
    speech.onNewWord = (word) => {
        const reversedWord = word.split('').reverse().join('');
        autoFlowQueue += reversedWord + " ";
    };

    // 3. Initialize Tracker
    await tracker.init();

    // 4. Start Speech
    speech.start();

    // 5. Start Game Loop
    isPlaying = true;
    requestAnimationFrame(loop);
}

function onResize() {
    if (renderer) {
        renderer.resize(window.innerWidth, window.innerHeight);
    }
}

let latestState = null;
let wasPinching = false;
let ribbonText = "";
let globalRibbon = null;
let ribbonIndex = 0;
let grabbedNodeIndex = -1;
let autoFlowQueue = "";
let flowFrameCounter = 0;

function loop() {
    if (!isPlaying) return;

    // Detect landmarks if video is ready and has valid dimensions
    if (video.currentTime !== lastVideoTime && video.videoWidth > 0 && video.videoHeight > 0) {
        lastVideoTime = video.currentTime;
        latestState = tracker.detect(video, performance.now(), canvas.width, canvas.height);
    }

    // Handle logic based on state
    if (latestState) {
        const { mouth, hand } = latestState;

        // Auto-flow logic from speech (pause if user is manually pulling!)
        if (autoFlowQueue.length > 0 && !wasPinching) {
            flowFrameCounter++;
            if (flowFrameCounter > 1) { // Output 1 char every 2 frames (smoother and faster)
                flowFrameCounter = 0;
                const char = autoFlowQueue[0];
                autoFlowQueue = autoFlowQueue.substring(1);
                
                const NODE_REST_LENGTH = 15;
                if (!globalRibbon) {
                    globalRibbon = physics.startString(mouth.x, mouth.y, char);
                } else {
                    physics.insertAtMouth(globalRibbon, mouth.x, mouth.y, char, NODE_REST_LENGTH);
                    if (grabbedNodeIndex !== -1) {
                        grabbedNodeIndex++;
                    }
                }
            }
        }

        // Ribbon logic
        if (hand.isPinching) {
            if (!wasPinching) {
                wasPinching = true;
                grabbedNodeIndex = -1;

                // Refresh the fallback text to the latest spoken words whenever we grab!
                ribbonText = speech.getRibbonText();
                if (!ribbonText) ribbonText = "silence falls";
                ribbonText = ribbonText.split('').reverse().join('');
                ribbonIndex = 0;

                if (globalRibbon) {
                    // Find closest node to hand
                    let closestDist = Infinity;
                    let closestIdx = -1;
                    for (let i = 0; i < globalRibbon.nodes.length; i++) {
                        const node = globalRibbon.nodes[i];
                        const dist = Math.sqrt(Math.pow(hand.x - node.x, 2) + Math.pow(hand.y - node.y, 2));
                        if (dist < closestDist) {
                            closestDist = dist;
                            closestIdx = i;
                        }
                    }
                    
                    // If close enough to grab (e.g. within 150px to be generous)
                    if (closestDist < 150) {
                        grabbedNodeIndex = closestIdx;
                    }
                }

                // If we didn't grab an existing node, check if hand is near the mouth to start pulling
                if (grabbedNodeIndex === -1) {
                    const distToMouth = Math.sqrt(Math.pow(hand.x - mouth.x, 2) + Math.pow(hand.y - mouth.y, 2));
                    // Require the hand to be somewhat near the mouth (e.g. 200px) to start a new pull
                    if (distToMouth < 200) {
                        if (!globalRibbon) {
                            globalRibbon = physics.startString(mouth.x, mouth.y, ribbonText[0]);
                            ribbonIndex = 1;
                        }
                        grabbedNodeIndex = 0; // Grab the root node
                    }
                }
            } 
            
            if (wasPinching && globalRibbon && grabbedNodeIndex !== -1) {
                if (!ribbonText) {
                    ribbonText = speech.getRibbonText();
                    if (!ribbonText) ribbonText = "silence falls";
                    ribbonText = ribbonText.split('').reverse().join('');
                }
                const NODE_REST_LENGTH = 15;

                // Pin first to mouth
                globalRibbon.nodes[0].x = mouth.x;
                globalRibbon.nodes[0].y = mouth.y;
                globalRibbon.nodes[0].isPinned = true;

                // Pin grabbed node to hand
                const grabbedNode = globalRibbon.nodes[grabbedNodeIndex];
                grabbedNode.x = hand.x;
                grabbedNode.y = hand.y;
                grabbedNode.isPinned = true;

                // Spawning new nodes at mouth if the pulled segment is stretched too far
                const pulledSegmentLen = grabbedNodeIndex * NODE_REST_LENGTH;
                const distHandToMouth = Math.sqrt(Math.pow(hand.x - mouth.x, 2) + Math.pow(hand.y - mouth.y, 2));
                
                // If distance is longer than resting length, insert a new letter AT THE MOUTH
                if (distHandToMouth > pulledSegmentLen && ribbonIndex < 1000) { 
                    let char;
                    if (autoFlowQueue.length > 0) {
                        // Consume from the active speech queue first
                        char = autoFlowQueue[0];
                        autoFlowQueue = autoFlowQueue.substring(1);
                    } else {
                        // Fallback to looping the cached ribbon text
                        char = ribbonText[ribbonIndex % ribbonText.length];
                        ribbonIndex++;
                    }
                    
                    physics.insertAtMouth(globalRibbon, mouth.x, mouth.y, char, NODE_REST_LENGTH);
                    // Shift the grabbed index since we inserted at index 0
                    grabbedNodeIndex++;
                }
            }
        } else {
            // Just released pinch
            if (wasPinching) {
                if (globalRibbon && grabbedNodeIndex !== -1) {
                    // Unpin the grabbed node so it falls
                    globalRibbon.nodes[grabbedNodeIndex].isPinned = false;
                }
            }
            wasPinching = false;
            grabbedNodeIndex = -1;
        }

        // Always keep the first node of the ribbon permanently anchored to the mouth
        if (globalRibbon && globalRibbon.nodes.length > 0) {
            globalRibbon.nodes[0].x = mouth.x;
            globalRibbon.nodes[0].y = mouth.y;
            globalRibbon.nodes[0].isPinned = true;
        }
    }

    // Render frame
    renderer.render(latestState);

    requestAnimationFrame(loop);
}

// Start
document.addEventListener('DOMContentLoaded', init);
