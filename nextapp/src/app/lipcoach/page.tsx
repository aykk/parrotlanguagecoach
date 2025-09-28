"use client";

import { useEffect, useRef, useState } from "react";

// Types
interface Landmark {
  x: number;
  y: number;
  z: number;
}

interface VisemeTimelineItem {
  start: number;
  end: number;
  viseme: string;
  word?: string;
}

interface SmoothedLandmarks {
  outer: Landmark[];
  inner: Landmark[];
}

// Constants
const MOUTH_CROP_SIZE = { width: 256, height: 192 };
const SAMPLE_SENTENCE = "the quick brown fox jumped over the lazy dog";
const TIMELINE_DURATION = 3.5; // seconds

// Lip landmark indices
const OUTER_LIP_INDICES = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291];
const INNER_LIP_INDICES = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];

// Viseme timeline for the sample sentence
const VISEME_TIMELINE: VisemeTimelineItem[] = [
  { start: 0.0, end: 0.2, viseme: "REST", word: "the" },
  { start: 0.2, end: 0.4, viseme: "TH", word: "the" },
  { start: 0.4, end: 0.6, viseme: "REST", word: "quick" },
  { start: 0.6, end: 0.8, viseme: "WQ", word: "quick" },
  { start: 0.8, end: 1.0, viseme: "IY", word: "quick" },
  { start: 1.0, end: 1.2, viseme: "CHJSH", word: "quick" },
  { start: 1.2, end: 1.4, viseme: "REST", word: "brown" },
  { start: 1.4, end: 1.6, viseme: "MBP", word: "brown" },
  { start: 1.6, end: 1.8, viseme: "R", word: "brown" },
  { start: 1.8, end: 2.0, viseme: "AO", word: "brown" },
  { start: 2.0, end: 2.2, viseme: "UW", word: "brown" },
  { start: 2.2, end: 2.4, viseme: "N", word: "brown" },
  { start: 2.4, end: 2.6, viseme: "REST", word: "fox" },
  { start: 2.6, end: 2.8, viseme: "FV", word: "fox" },
  { start: 2.8, end: 3.0, viseme: "AO", word: "fox" },
  { start: 3.0, end: 3.2, viseme: "CHJSH", word: "fox" },
  { start: 3.2, end: 3.5, viseme: "REST", word: "jumped" }
];

// Viseme SVG paths (simplified mouth shapes)
const VISEME_PATHS: Record<string, string> = {
  REST: "M 50 96 Q 128 80 206 96 Q 128 112 50 96",
  MBP: "M 50 96 Q 128 60 206 96 Q 128 132 50 96",
  FV: "M 50 96 Q 128 70 206 96 Q 128 122 50 96",
  TH: "M 50 96 Q 128 90 206 96 Q 128 102 50 96",
  L: "M 50 96 Q 128 85 206 96 Q 128 107 50 96",
  WQ: "M 50 96 Q 128 75 206 96 Q 128 117 50 96",
  AA: "M 50 96 Q 128 50 206 96 Q 128 142 50 96",
  AE: "M 50 96 Q 128 55 206 96 Q 128 137 50 96",
  AH: "M 50 96 Q 128 60 206 96 Q 128 132 50 96",
  AO: "M 50 96 Q 128 65 206 96 Q 128 127 50 96",
  IY: "M 50 96 Q 128 85 206 96 Q 128 107 50 96",
  UW: "M 50 96 Q 128 80 206 96 Q 128 112 50 96",
  CHJSH: "M 50 96 Q 128 70 206 96 Q 128 122 50 96",
  R: "M 50 96 Q 128 75 206 96 Q 128 117 50 96",
  N: "M 50 96 Q 128 90 206 96 Q 128 102 50 96"
};

// Script loader utility
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export default function LipCoachPage() {
  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showGhostOverlay, setShowGhostOverlay] = useState(false);
  const [error, setError] = useState<string>("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const userMouthCanvasRef = useRef<HTMLCanvasElement>(null);
  const ghostCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const smoothedLandmarksRef = useRef<SmoothedLandmarks | null>(null);
  const lastLandmarksRef = useRef<SmoothedLandmarks | null>(null);

  // EMA smoothing factor
  const SMOOTHING_ALPHA = 0.6;

  // Smooth landmarks using EMA
  const smoothLandmarks = (current: SmoothedLandmarks, previous: SmoothedLandmarks | null): SmoothedLandmarks => {
    if (!previous) return current;
    
    return {
      outer: current.outer.map((curr, i) => ({
        x: SMOOTHING_ALPHA * curr.x + (1 - SMOOTHING_ALPHA) * previous.outer[i].x,
        y: SMOOTHING_ALPHA * curr.y + (1 - SMOOTHING_ALPHA) * previous.outer[i].y,
        z: SMOOTHING_ALPHA * curr.z + (1 - SMOOTHING_ALPHA) * previous.outer[i].z,
      })),
      inner: current.inner.map((curr, i) => ({
        x: SMOOTHING_ALPHA * curr.x + (1 - SMOOTHING_ALPHA) * previous.inner[i].x,
        y: SMOOTHING_ALPHA * curr.y + (1 - SMOOTHING_ALPHA) * previous.inner[i].y,
        z: SMOOTHING_ALPHA * curr.z + (1 - SMOOTHING_ALPHA) * previous.inner[i].z,
      })),
    };
  };

  // Extract lip landmarks from MediaPipe results
  const extractLipLandmarks = (landmarks: Landmark[]): SmoothedLandmarks => {
    const outer = OUTER_LIP_INDICES.map(i => landmarks[i]);
    const inner = INNER_LIP_INDICES.map(i => landmarks[i]);
    return { outer, inner };
  };

  // Compute similarity transform for mouth stabilization
  const computeSimilarityTransform = (landmarks: SmoothedLandmarks) => {
    const outer = landmarks.outer;
    const leftCorner = outer[0]; // index 61
    const rightCorner = outer[10]; // index 291
    const upperInner = landmarks.inner[0]; // index 78

    // Calculate center point
    const centerX = (leftCorner.x + rightCorner.x) / 2;
    const centerY = (leftCorner.y + rightCorner.y) / 2;

    // Calculate scale based on mouth width
    const mouthWidth = Math.sqrt(
      Math.pow(rightCorner.x - leftCorner.x, 2) + 
      Math.pow(rightCorner.y - leftCorner.y, 2)
    );
    const targetWidth = MOUTH_CROP_SIZE.width * 0.8; // Use 80% of canvas width
    const scale = targetWidth / mouthWidth;

    // Calculate rotation angle
    const angle = Math.atan2(rightCorner.y - leftCorner.y, rightCorner.x - leftCorner.x);

    return { centerX, centerY, scale, angle };
  };

  // Draw stabilized mouth crop
  const drawMouthCrop = (landmarks: SmoothedLandmarks) => {
    const canvas = userMouthCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const transform = computeSimilarityTransform(landmarks);
    
    // Apply similarity transform
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(transform.scale, transform.scale);
    ctx.rotate(-transform.angle);
    ctx.translate(-transform.centerX, -transform.centerY);

    // Draw mouth outline
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    const outer = landmarks.outer;
    ctx.moveTo(outer[0].x * canvas.width, outer[0].y * canvas.height);
    for (let i = 1; i < outer.length; i++) {
      ctx.lineTo(outer[i].x * canvas.width, outer[i].y * canvas.height);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw inner mouth
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    const inner = landmarks.inner;
    ctx.moveTo(inner[0].x * canvas.width, inner[0].y * canvas.height);
    for (let i = 1; i < inner.length; i++) {
      ctx.lineTo(inner[i].x * canvas.width, inner[i].y * canvas.height);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  };

  // Draw ghost overlay
  const drawGhostOverlay = (viseme: string) => {
    const canvas = ghostCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.6;

    // Draw SVG path
    const path = VISEME_PATHS[viseme] || VISEME_PATHS.REST;
    const path2D = new Path2D(path);
    
    ctx.strokeStyle = "#ffff00";
    ctx.lineWidth = 3;
    ctx.stroke(path2D);

    ctx.globalAlpha = 1.0;
  };

  // Get current viseme based on timeline
  const getCurrentViseme = (time: number): string => {
    const item = VISEME_TIMELINE.find(item => time >= item.start && time < item.end);
    return item?.viseme || "REST";
  };

  // Animation loop
  const animate = () => {
    if (!isPlaying) return;

    setCurrentTime(prev => {
      const newTime = prev + 0.016; // ~60fps
      if (newTime >= TIMELINE_DURATION) {
        setIsPlaying(false);
        return TIMELINE_DURATION;
      }
      return newTime;
    });

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Initialize MediaPipe and camera
  useEffect(() => {
    let stopped = false;

    const initializeMediaPipe = async () => {
      try {
        // Load MediaPipe scripts
        const base = "https://cdn.jsdelivr.net/npm/@mediapipe";
        await loadScript(`${base}/camera_utils/camera_utils.js`);
        await loadScript(`${base}/face_mesh/face_mesh.js`);
        
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (stopped) return;

        const win = window as any;
        const FaceMesh = win.FaceMesh;
        const Camera = win.Camera;

        if (!FaceMesh || !Camera) {
          setError("Failed to load MediaPipe libraries");
          return;
        }

        if (!videoRef.current || !userMouthCanvasRef.current) return;

        // Initialize FaceMesh
        const faceMesh = new FaceMesh({
          locateFile: (file: string) => `${base}/face_mesh/${file}`
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results: any) => {
          const landmarks = results.multiFaceLandmarks?.[0];
          if (landmarks) {
            const currentLandmarks = extractLipLandmarks(landmarks);
            const smoothed = smoothLandmarks(currentLandmarks, lastLandmarksRef.current);
            lastLandmarksRef.current = smoothed;
            smoothedLandmarksRef.current = smoothed;
            drawMouthCrop(smoothed);
          }
        });

        faceMeshRef.current = faceMesh;

        // Initialize camera
        const camera = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && faceMeshRef.current) {
              await faceMeshRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });

        cameraRef.current = camera;

        await camera.start();
        setIsInitialized(true);
        setError("");

      } catch (err) {
        console.error("MediaPipe initialization failed:", err);
        setError("Failed to initialize camera and face detection");
      }
    };

    initializeMediaPipe();

    return () => {
      stopped = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (cameraRef.current?.stop) {
        cameraRef.current.stop();
      }
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Handle play/pause
  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Update ghost overlay when time changes
  useEffect(() => {
    if (showGhostOverlay) {
      const viseme = getCurrentViseme(currentTime);
      drawGhostOverlay(viseme);
    }
  }, [currentTime, showGhostOverlay]);

  // Control handlers
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleGhostToggle = () => {
    setShowGhostOverlay(!showGhostOverlay);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Lip Coach</h1>
        
        {error && (
          <div className="bg-red-600 text-white p-4 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* User Mouth Crop */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-center">Your Mouth</h2>
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full h-48 object-cover rounded-lg mb-4"
                autoPlay
                playsInline
                muted
                style={{ transform: "scaleX(-1)" }}
              />
              <canvas
                ref={userMouthCanvasRef}
                width={MOUTH_CROP_SIZE.width}
                height={MOUTH_CROP_SIZE.height}
                className="absolute top-4 left-1/2 transform -translate-x-1/2 border-2 border-green-500 rounded"
                style={{ transform: "translateX(-50%) scaleX(-1)" }}
              />
              {showGhostOverlay && (
                <canvas
                  ref={ghostCanvasRef}
                  width={MOUTH_CROP_SIZE.width}
                  height={MOUTH_CROP_SIZE.height}
                  className="absolute top-4 left-1/2 transform -translate-x-1/2 pointer-events-none"
                  style={{ transform: "translateX(-50%) scaleX(-1)" }}
                />
              )}
            </div>
          </div>

          {/* Coach Mouth */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-center">Coach Mouth</h2>
            <div className="flex justify-center">
              <svg
                width={MOUTH_CROP_SIZE.width}
                height={MOUTH_CROP_SIZE.height}
                viewBox="0 0 256 192"
                className="border-2 border-yellow-500 rounded"
              >
                <path
                  d={VISEME_PATHS[getCurrentViseme(currentTime)]}
                  fill="none"
                  stroke="#ffff00"
                  strokeWidth="3"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>0s</span>
              <span>{TIMELINE_DURATION}s</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-100"
                style={{ width: `${(currentTime / TIMELINE_DURATION) * 100}%` }}
              />
            </div>
          </div>
          
          {/* Current word/phoneme */}
          <div className="text-center">
            <p className="text-lg font-semibold">
              {VISEME_TIMELINE.find(item => 
                currentTime >= item.start && currentTime < item.end
              )?.word || "Ready"}
            </p>
            <p className="text-sm text-gray-400">
              "{SAMPLE_SENTENCE}"
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          <button
            onClick={handlePlayPause}
            disabled={!isInitialized}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              isPlaying
                ? "bg-red-600 hover:bg-red-700"
                : "bg-green-600 hover:bg-green-700"
            } ${!isInitialized ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isPlaying ? "Stop" : "Play Coach"}
          </button>
          
          <button
            onClick={handleGhostToggle}
            className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
              showGhostOverlay
                ? "bg-yellow-600 hover:bg-yellow-700"
                : "bg-gray-600 hover:bg-gray-700"
            }`}
          >
            {showGhostOverlay ? "Hide Ghost" : "Ghost Overlay"}
          </button>
          
          <button
            onClick={handleReset}
            className="px-6 py-3 rounded-lg font-semibold bg-gray-600 hover:bg-gray-700 transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Instructions</h3>
          <ul className="space-y-2 text-gray-300">
            <li>• Allow camera access when prompted</li>
            <li>• Position your face in the camera view</li>
            <li>• Click "Play Coach" to see the animated mouth shapes</li>
            <li>• Use "Ghost Overlay" to compare your mouth with the coach</li>
            <li>• Practice matching the mouth shapes as they appear</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
