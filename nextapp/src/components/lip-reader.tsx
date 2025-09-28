"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Play, Square, Camera, Eye } from "lucide-react";

/** Load UMD scripts from CDN (MediaPipe FaceMesh) */
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

type Landmark = { x: number; y: number };
type LipFrame = {
  /** normalized [0..1] points (x,y) for stable outline playback */
  points: Array<[number, number]>;
  /** full landmarks for connector-accurate playback */
  landmarks: Landmark[];
  /** timestamp in ms relative to recording start */
  t: number;
};

export interface LipReaderRef {
  startPlayback: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  clearData: () => void;
  hasRecordedData: () => boolean;
}

const LipReader = forwardRef<LipReaderRef>((props, ref) => {
  // --- live capture ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- recording (video+audio) ---
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null); // mic stream (audio)
  const recStartRef = useRef<number>(0); // perf.now() at record start

  // --- lips frames for isolated playback ---
  const lipFramesRef = useRef<LipFrame[]>([]);
  const recordingStartTimeRef = useRef<number>(0); // actual recording start for sync
  const [currentLandmarks, setCurrentLandmarks] = useState<Landmark[] | null>(null);

  // --- isolated playback (outline + video sync) ---
  const isoCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoPlaybackRef = useRef<HTMLVideoElement>(null);
  const currentVideoUrlRef = useRef<string | null>(null);
  const [isoIndex, setIsoIndex] = useState(0);
  const [isPlayingIso, setIsPlayingIso] = useState(false);

  // --- volume monitoring ---
  const volumeBarRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(0);
  const rafRef = useRef<number | null>(null);

  // --- status text ---
  const [status, setStatus] = useState("Ready");

  // DPR-sync canvas to video pixels
  const syncCanvasToVideo = () => {
    const v = videoRef.current;
    const c = liveCanvasRef.current;
    if (!v || !c || !v.videoWidth || !v.videoHeight) return;
    
    // Get the actual video dimensions
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    
    // Set canvas to match video exactly
    c.width = vw;
    c.height = vh;
    
    // Position canvas to cover the video exactly
    c.style.position = 'absolute';
    c.style.top = '0';
    c.style.left = '0';
    c.style.width = '100%';
    c.style.height = '100%';
  };

  // Stop playback without toggling
  const stopPlayback = () => {
    const video = videoPlaybackRef.current;
    
    if (video) {
      video.pause();
      video.currentTime = 0;
    }
    setIsPlayingIso(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  // Clear all recorded data
  const clearAllData = () => {
    console.log('clearAllData called');
    
    // Stop any ongoing playback
    stopPlayback();
    
    // Clear recorded data
    setRecordedUrl(null);
    currentVideoUrlRef.current = null;
    lipFramesRef.current = [];
    setIsoIndex(0);
    setIsPlayingIso(false);
    
    // Clear canvas
    const c = isoCanvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, c.width, c.height);
      }
    }
    
    setStatus("Ready");
    console.log('clearAllData completed');
  };

  // Expose functions to parent
  useImperativeHandle(ref, () => ({
    startPlayback: () => {
      console.log('startPlayback called');
      console.log('lipFramesRef.current.length:', lipFramesRef.current.length);
      console.log('recordedUrl:', recordedUrl);
      if (lipFramesRef.current.length > 0 && recordedUrl) {
        console.log('Starting playback...');
        startIsoWithAudio();
      } else {
        console.log('Cannot start playback - missing data');
      }
    },
    startRecording: () => {
      console.log('Lip reader startRecording called');
      if (!isRecording) {
        toggleRecording();
      }
    },
    stopRecording: () => {
      console.log('Lip reader stopRecording called');
      if (isRecording) {
        toggleRecording();
      }
    },
    clearData: clearAllData,
    hasRecordedData: () => {
      return recordedUrl !== null && lipFramesRef.current.length > 0;
    }
  }));

  // Start volume monitoring
  useEffect(() => {
    startVolumeMonitoring();
    return () => stopVolumeMonitoring();
  }, []);

  // Ensure video element is properly loaded when URL changes
  useEffect(() => {
    if (recordedUrl && videoPlaybackRef.current) {
      // Check if the URL is already set to prevent unnecessary loading
      if (currentVideoUrlRef.current === recordedUrl) {
        console.log('Video URL already set, skipping load');
        return;
      }
      
      console.log('Video URL changed, loading video:', recordedUrl);
      currentVideoUrlRef.current = recordedUrl;
      
      // Add a small delay to prevent rapid loading
      const timeoutId = setTimeout(() => {
        try {
          if (videoPlaybackRef.current && recordedUrl) {
            // Check if video is already loading to prevent abort errors
            if (videoPlaybackRef.current.readyState === 0) {
              console.log('Video already loading, skipping load call');
              return;
            }
            videoPlaybackRef.current.load();
          }
        } catch (error) {
          // AbortError is normal when video URL changes rapidly
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('Video load aborted (normal when URL changes rapidly)');
          } else {
            console.error('Video load error:', error);
          }
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [recordedUrl]);

  // Setup camera + FaceMesh overlay
  useEffect(() => {
    let stopped = false;
    let cameraInstance: any = null;

    (async () => {
      try {
        const base = "https://cdn.jsdelivr.net/npm/@mediapipe";
        await loadScript(`${base}/drawing_utils/drawing_utils.js`);
        await loadScript(`${base}/camera_utils/camera_utils.js`);
        await loadScript(`${base}/face_mesh/face_mesh.js`);
        await new Promise((r) => setTimeout(r, 250));
        if (stopped) return;

        const win = window as any;
        const FaceMesh = win.FaceMesh;
        const FACEMESH_LIPS = win.FACEMESH_LIPS as Array<[number, number]>;
        const Camera = win.Camera;
        if (!FaceMesh || !FACEMESH_LIPS || !Camera) {
          setStatus("Failed to load MediaPipe");
          return;
        }

        if (!videoRef.current || !liveCanvasRef.current) return;
        const canvas = liveCanvasRef.current;
        const ctx = canvas.getContext("2d")!;
        const faceMesh = new FaceMesh({
          locateFile: (f: string) => `${base}/face_mesh/${f}`,
        });
        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results: any) => {
          const landmarks: Landmark[] | undefined = results.multiFaceLandmarks?.[0];
          ctx.save();
          syncCanvasToVideo();
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (landmarks && videoRef.current) {
            // Store current landmarks for live display
            setCurrentLandmarks(landmarks);
            const video = videoRef.current;
            const vw = video.videoWidth || 640;
            const vh = video.videoHeight || 480;

            // Draw lips with proper coordinate mapping
            ctx.strokeStyle = "#00FF00";
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            // Debug: log first few lip points
            if (landmarks && landmarks.length > 0) {
              const firstLip = landmarks[FACEMESH_LIPS[0][0]];
              // Lip tracking active
            }

            for (const [a, b] of FACEMESH_LIPS) {
              const p1 = landmarks[a];
              const p2 = landmarks[b];
              if (!p1 || !p2) continue;
              ctx.beginPath();
              // Use normalized coordinates directly (MediaPipe gives 0-1 range)
              ctx.moveTo(p1.x * vw, p1.y * vh);
              ctx.lineTo(p2.x * vw, p2.y * vh);
              ctx.stroke();
            }

            setStatus("Face detected — lips tracking active");

            // While recording, stash timestamped frame with throttling for better performance
            if (isRecording) {
              const t = performance.now() - recStartRef.current;
              const lastFrame = lipFramesRef.current[lipFramesRef.current.length - 1];
              const timeSinceLastFrame = t - (lastFrame?.t || 0);
              
              // Throttle to ~30fps to reduce processing overhead
              if (timeSinceLastFrame > 33) {
                const pts = extractUniqueLipPoints(landmarks, FACEMESH_LIPS);
                lipFramesRef.current.push({ points: pts, landmarks, t });
              }
            }
          } else {
            setStatus("Camera ready — waiting for face");
          }
          ctx.restore();
        });

        cameraInstance = new Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current?.readyState! >= 2) {
              try {
                await faceMesh.send({ image: videoRef.current });
              } catch {
                /* ignore transient errors */
              }
            }
          },
          width: 640,
          height: 480,
        });

        await cameraInstance.start();
        setStatus("Camera ready");
      } catch (e) {
        console.error(e);
        setStatus("Could not start camera (HTTPS + permission required)");
      }
    })();

    return () => {
      stopped = true;
      try {
        const stream = (videoRef.current?.srcObject as MediaStream) || null;
        stream?.getTracks().forEach((t) => t.stop());
        cameraInstance?.stop?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  // Cleanup camera and microphone when page becomes hidden or user navigates away
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, stop camera and microphone
        try {
          const stream = (videoRef.current?.srcObject as MediaStream) || null;
          stream?.getTracks().forEach((t) => t.stop());
          setStatus("Camera stopped (page hidden)");
        } catch (error) {
          console.error("Error stopping camera on visibility change:", error);
        }
      }
    };

    const handleBeforeUnload = () => {
      // Stop camera and microphone when user navigates away
      try {
        const stream = (videoRef.current?.srcObject as MediaStream) || null;
        stream?.getTracks().forEach((t) => t.stop());
      } catch (error) {
        console.error("Error stopping camera on beforeunload:", error);
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup event listeners
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Start/Stop recording with MIC + VIDEO (combined)
  const toggleRecording = async () => {
    console.log('toggleRecording called, videoRef:', !!videoRef.current);
    console.log('videoRef srcObject:', !!videoRef.current?.srcObject);
    if (!videoRef.current) {
      console.log('No video ref, cannot record');
      return;
    }

    if (!isRecording) {
      // cleanup previous
      stopIsoPlayback();
      setRecordedUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
      recordedChunksRef.current = [];
      lipFramesRef.current = [];

      // 1) get mic
      try {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.error("Mic permission/stream failed:", err);
        setStatus("Microphone access required for recording");
        return;
      }

      // 2) get video track from current video element (MediaPipe Camera set this)
      const camStream = videoRef.current.srcObject as MediaStream | null;
      console.log('Camera stream:', !!camStream);
      if (!camStream) {
        console.log('No camera stream available');
        setStatus("No camera stream");
        return;
      }
      const videoTrack = camStream.getVideoTracks()[0];
      if (!videoTrack) {
        setStatus("No video track");
        return;
      }

      // 3) combine video and audio tracks into one stream
      const combinedStream = new MediaStream([videoTrack, ...micStreamRef.current.getAudioTracks()]);

      // 4) start combined recorder
      const recorder = new MediaRecorder(combinedStream, { mimeType: "video/webm;codecs=vp8,opus" });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        console.log('MediaRecorder stopped, chunks:', recordedChunksRef.current.length);
        const videoBlob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        console.log('Video blob size:', videoBlob.size);
        const recordedUrl = URL.createObjectURL(videoBlob);
        console.log('Setting recorded URL:', recordedUrl);
        setRecordedUrl(recordedUrl);
      };

      recStartRef.current = performance.now(); // for frame timestamps
      recordingStartTimeRef.current = Date.now(); // actual recording start for sync
      console.log('Starting MediaRecorder...');
      recorder.start(100); // collect chunks

      setIsRecording(true);
      console.log('Recording started successfully');
      setStatus("Recording…");
    } else {
      mediaRecorderRef.current?.stop();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      setIsRecording(false);
      setStatus("Recording stopped");
    }
  };

  // --- Volume monitoring ---
  const startVolumeMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      // DO NOT connect to destination to prevent audio feedback
      // analyser.connect(audioContext.destination); // This line causes feedback

      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const volumePercent = (average / 255) * 100;
        setVolume(volumePercent);
        
        // Update the volume bar
        const volumeBar = document.getElementById('volume-bar');
        if (volumeBar) {
          volumeBar.style.width = `${Math.min(volumePercent, 100)}%`;
        }
        
        rafRef.current = requestAnimationFrame(updateVolume);
      };
      
      updateVolume();
    } catch (error) {
      console.error("Volume monitoring failed:", error);
    }
  };

  const stopVolumeMonitoring = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  // --- Isolated playback synced to video ---
  const startIsoWithAudio = () => {
    console.log('startIsoWithAudio called');
    console.log('videoPlaybackRef.current:', !!videoPlaybackRef.current);
    console.log('lipFramesRef.current.length:', lipFramesRef.current.length);
    
    if (!videoPlaybackRef.current || lipFramesRef.current.length === 0) {
      console.log('Cannot start playback - missing video ref or frames');
      return;
    }
    
    // Calibrate sync before starting
    calibrateSync();
    
    // Reset video to beginning
    if (videoPlaybackRef.current) {
      videoPlaybackRef.current.currentTime = 0;
    }
    
    // Play only the video (which contains both video and audio)
    console.log('About to play video, src:', videoPlaybackRef.current?.src);
    console.log('Video readyState:', videoPlaybackRef.current?.readyState);
    
    // Ensure video is loaded before playing
    if (videoPlaybackRef.current && videoPlaybackRef.current.readyState < 3) {
      console.log('Video not ready, waiting for canplay event');
      videoPlaybackRef.current.addEventListener('canplay', () => {
        console.log('Video can play now, starting playback');
        videoPlaybackRef.current?.play().then(() => {
          console.log('Video playback started successfully');
          setIsPlayingIso(true);
          setIsoIndex(0);
          tick();
        }).catch((e) => {
          console.error("Playback blocked:", e);
        });
      }, { once: true });
      return;
    }
    
    const playVideo = videoPlaybackRef.current ? videoPlaybackRef.current.play() : Promise.resolve();
    
    playVideo.then(() => {
      console.log('Video playback started successfully');
      setIsPlayingIso(true);
      setIsoIndex(0);
      tick();
    }).catch((e) => {
      console.error("Playback blocked:", e);
    });
  };

  const pauseIso = () => {
    const video = videoPlaybackRef.current;
    
    if (!video) return;
    
    if (video.paused) {
      void video.play().then(() => {
        setIsPlayingIso(true);
        tick();
      });
    } else {
      video.pause();
      setIsPlayingIso(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const stopIsoPlayback = () => {
    if (videoPlaybackRef.current) {
      videoPlaybackRef.current.pause();
      videoPlaybackRef.current.currentTime = 0;
    }
    setIsPlayingIso(false);
    setIsoIndex(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  // Drive isoIndex off video currentTime using RAF with improved sync
  const tick = () => {
    const video = videoPlaybackRef.current;
    
    if (!video) return;
    
    const currentTime = video.currentTime;
    const audioMs = currentTime * 1000;
    const frames = lipFramesRef.current;
    if (frames.length === 0) return;

    // Optimized frame finding with binary search for better performance
    let bestIndex = 0;
    let minDiff = Infinity;

    // Use binary search for better performance with large frame arrays
    let left = 0;
    let right = frames.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const diff = frames[mid].t - audioMs;
      
      if (Math.abs(diff) < minDiff) {
        minDiff = Math.abs(diff);
        bestIndex = mid;
      }
      
      if (diff < 0) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // Only update if the difference is significant to avoid jitter
    // Reduced threshold for smoother playback
    if (Math.abs(bestIndex - isoIndex) > 0 || minDiff < 25) {
      setIsoIndex(bestIndex);
    }

    const isPlaying = video && !video.paused && !video.ended;
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setIsPlayingIso(false);
    }
  };

  // Calibrate sync offset by finding the best alignment
  const calibrateSync = () => {
    const video = videoPlaybackRef.current;
    
    if (!video || lipFramesRef.current.length === 0) return;
    
    // Use video duration since that's what we're actually playing
    const duration = video.duration;
    const audioDuration = duration * 1000;
    const frameDuration = lipFramesRef.current[lipFramesRef.current.length - 1]?.t || 0;
    
    // Calculate potential offset
    const durationDiff = audioDuration - frameDuration;
    // Audio and frame duration calculated
    
    // If there's a significant difference, we might need to adjust frame timestamps
    if (Math.abs(durationDiff) > 100) {
      // Duration mismatch detected - this is normal for lip tracking
    }
  };

  // Draw the current isolated lips frame into iso canvas
  useEffect(() => {
    const c = isoCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, c.width, c.height);

    // If we have recorded frames and are playing, show the current frame
    const frame = lipFramesRef.current[isoIndex];
    if (frame && isPlayingIso) {
      const win = window as any;
      const FACEMESH_LIPS: Array<[number, number]> = win.FACEMESH_LIPS;
      const W = c.width;
      const H = c.height;
      const margin = 40;

      // Compute centroid & scale (normalized [0..1] -> canvas)
      const cx = frame.points.reduce((s, p) => s + p[0], 0) / Math.max(1, frame.points.length);
      const cy = frame.points.reduce((s, p) => s + p[1], 0) / Math.max(1, frame.points.length);
      const xs = frame.points.map((p) => p[0]);
      const ys = frame.points.map((p) => p[1]);
      const mouthW = Math.max(0.001, Math.max(...xs) - Math.min(...xs));
      const mouthH = Math.max(0.001, Math.max(...ys) - Math.min(...ys));
      const availW = W - margin * 2;
      const availH = H - margin * 2;
      const scale = Math.min(availW / mouthW, availH / mouthH) * 0.85;

      const scaled = frame.landmarks.map((p) => ({
        x: (p.x - cx) * scale + W / 2,
        y: (p.y - cy) * scale + H / 2,
      }));

      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#00FF00";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const [a, b] of FACEMESH_LIPS) {
        const p1 = scaled[a];
        const p2 = scaled[b];
        if (!p1 || !p2) continue;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    } else if (currentLandmarks && !isPlayingIso) {
      // Show live landmarks when not playing back
      const win = window as any;
      const FACEMESH_LIPS: Array<[number, number]> = win.FACEMESH_LIPS;
      const W = c.width;
      const H = c.height;
      const margin = 40;

      // Compute centroid & scale for live landmarks
      const lipPoints = extractUniqueLipPoints(currentLandmarks, FACEMESH_LIPS);
      const cx = lipPoints.reduce((s, p) => s + p[0], 0) / Math.max(1, lipPoints.length);
      const cy = lipPoints.reduce((s, p) => s + p[1], 0) / Math.max(1, lipPoints.length);
      const xs = lipPoints.map((p) => p[0]);
      const ys = lipPoints.map((p) => p[1]);
      const mouthW = Math.max(0.001, Math.max(...xs) - Math.min(...xs));
      const mouthH = Math.max(0.001, Math.max(...ys) - Math.min(...ys));
      const availW = W - margin * 2;
      const availH = H - margin * 2;
      const scale = Math.min(availW / mouthW, availH / mouthH) * 0.85;

      const scaled = currentLandmarks.map((p) => ({
        x: (p.x - cx) * scale + W / 2,
        y: (p.y - cy) * scale + H / 2,
      }));

      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#00FF00";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const [a, b] of FACEMESH_LIPS) {
        const p1 = scaled[a];
        const p2 = scaled[b];
        if (!p1 || !p2) continue;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [isoIndex, isPlayingIso, currentLandmarks]);

  // Utilities
  function extractUniqueLipPoints(
    landmarks: Array<{ x: number; y: number }>,
    FACEMESH_LIPS: Array<[number, number]>
  ): Array<[number, number]> {
    const set = new Set<number>();
    for (const [a, b] of FACEMESH_LIPS) {
      set.add(a);
      set.add(b);
    }
    const ordered = Array.from(set.values()).sort((a, b) => a - b);
    const pts: Array<[number, number]> = [];
    for (const idx of ordered) {
      const p = landmarks[idx];
      if (p) pts.push([p.x, p.y]);
    }
    return pts;
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Eye className="w-4 h-4 text-gray-700" />
        <h3 className="text-sm font-medium text-gray-700">Isolated Lip Sync</h3>
      </div>

      {/* Hidden Live Feed (needed for lip tracking) */}
      <div className="hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={syncCanvasToVideo}
          className="w-full h-full object-cover scale-x-[-1]"
        />
        <canvas
          ref={liveCanvasRef}
          className="absolute top-0 left-0 pointer-events-none scale-x-[-1]"
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Isolated Lip Sync Display */}
      <div className="w-full aspect-[4/3] bg-black rounded-lg flex items-center justify-center relative mb-4">
        <canvas ref={isoCanvasRef} width={480} height={360} className="max-w-full scale-x-[-1]" />
        {/* Hidden video element for playback (contains both video and audio) */}
        <video 
          ref={videoPlaybackRef} 
          src={recordedUrl || undefined} 
          preload="metadata" 
          className="hidden"
          onLoadedData={() => {
            console.log('Video loaded data, readyState:', videoPlaybackRef.current?.readyState);
          }}
          onCanPlay={() => {
            console.log('Video can play, readyState:', videoPlaybackRef.current?.readyState);
          }}
          onError={(e) => {
            console.log('Video error (may be normal during URL changes):', e);
          }}
          onAbort={() => {
            console.log('Video load aborted (normal when URL changes rapidly)');
          }}
          onTimeUpdate={() => {
            // Video time update for lip sync
            // No need to sync with separate audio since video contains both
          }}
        />
      </div>

      {/* Status */}
      <p className="text-xs text-gray-500">Status: {status}</p>
    </div>
  );
});

LipReader.displayName = 'LipReader';

export default LipReader;
