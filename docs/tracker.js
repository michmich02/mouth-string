import { FaceLandmarker, HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/+esm";

export class Tracker {
    constructor() {
        this.faceLandmarker = null;
        this.handLandmarker = null;
        this.isReady = false;
    }

    async init() {
        console.log("Initializing MediaPipe Trackers...");
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
        );

        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: "CPU"
            },
            outputFaceBlendshapes: true,
            runningMode: "VIDEO",
            numFaces: 1
        });

        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "CPU"
            },
            runningMode: "VIDEO",
            numHands: 2
        });

        this.isReady = true;
        console.log("Trackers ready.");
    }

    // Process a video frame and return structured state
    // canvasWidth and canvasHeight are needed to convert normalized coordinates to screen space
    detect(video, timeInMs, canvasWidth, canvasHeight) {
        if (!this.isReady) return null;

        const faceResult = this.faceLandmarker.detectForVideo(video, timeInMs);
        const handResult = this.handLandmarker.detectForVideo(video, timeInMs);

        let state = {
            mouth: { isOpen: false, x: 0, y: 0 },
            hand: { isPinching: false, x: 0, y: 0 }
        };

        // Process Face
        if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
            const landmarks = faceResult.faceLandmarks[0];
            
            // Mouth landmarks: 13 (upper inner lip), 14 (lower inner lip)
            // Left mouth corner: 61, Right mouth corner: 291
            const upperLip = landmarks[13];
            const lowerLip = landmarks[14];
            const leftCorner = landmarks[61];
            const rightCorner = landmarks[291];

            // Calculate mouth center
            const cx = (leftCorner.x + rightCorner.x) / 2;
            const cy = (upperLip.y + lowerLip.y) / 2;

            // Distance between lips
            const openness = Math.abs(lowerLip.y - upperLip.y);
            
            // Map coordinates, flipping X since we mirror the webcam
            state.mouth.x = (1 - cx) * canvasWidth;
            state.mouth.y = cy * canvasHeight;
            state.mouth.isOpen = openness > 0.02; // Threshold for open mouth
        }

        // Process Hand
        if (handResult.landmarks && handResult.landmarks.length > 0) {
            // Find the closest hand or primary hand
            const landmarks = handResult.landmarks[0];
            
            // Thumb tip: 4, Index tip: 8
            const thumb = landmarks[4];
            const index = landmarks[8];

            const dx = thumb.x - index.x;
            const dy = thumb.y - index.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const px = (thumb.x + index.x) / 2;
            const py = (thumb.y + index.y) / 2;

            state.hand.x = (1 - px) * canvasWidth;
            state.hand.y = py * canvasHeight;
            state.hand.isPinching = dist < 0.1; // Pinch threshold increased for easier detection
        }

        return state;
    }
}
