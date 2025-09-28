"use client";

import { useEffect, useRef, useState } from "react";

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

export default function LipReadSimple() {
  // --- live capture ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- recording (video+audio) ---
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null); // separate audio recorder
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null); // separate audio blob URL
  const micStreamRef = useRef<MediaStream | null>(null); // mic stream (audio)
  const recStartRef = useRef<number>(0); // perf.now() at record start

  // --- lips frames for isolated playback ---
  const lipFramesRef = useRef<LipFrame[]>([]);
  const recordingStartTimeRef = useRef<number>(0); // actual recording start time for sync

  // --- isolated playback (outline + audio sync) ---
  const isoCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isoIndex, setIsoIndex] = useState(0);
  const [isPlayingIso, setIsPlayingIso] = useState(false);
  const [syncOffset, setSyncOffset] = useState(0); // manual sync adjustment in ms
  const rafRef = useRef<number | null>(null);

  // --- status text ---
  const [status, setStatus] = useState("Ready");

  // DPR-sync canvas to video pixels
  const syncCanvasToVideo = () => {
    const v = videoRef.current;
    const c = liveCanvasRef.current;
    if (!v || !c || !v.videoWidth || !v.videoHeight) return;
    const dpr = window.devicePixelRatio || 1;
    const vw = v.videoWidth;
    const vh = v.videoHeight;

    if (c.width !== vw * dpr || c.height !== vh * dpr) {
      c.width = vw * dpr;
      c.height = vh * dpr;
      c.style.width = `${vw}px`;
      c.style.height = `${vh}px`;
      const ctx = c.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  };

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
            const video = videoRef.current;
            const vw = video.videoWidth || 640;
            const vh = video.videoHeight || 480;

            // Draw lips (aligned with mirrored video; no manual x-flip)
            ctx.strokeStyle = "#00FF00";
            ctx.lineWidth = 3;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            for (const [a, b] of FACEMESH_LIPS) {
              const p1 = landmarks[a];
              const p2 = landmarks[b];
              if (!p1 || !p2) continue;
              ctx.beginPath();
              ctx.moveTo(p1.x * vw, p1.y * vh);
              ctx.lineTo(p2.x * vw, p2.y * vh);
              ctx.stroke();
            }

            setStatus("Face detected — lips tracking active");

            // While recording, stash timestamped frame
            if (isRecording) {
              const t = performance.now() - recStartRef.current;
              const pts = extractUniqueLipPoints(landmarks, FACEMESH_LIPS);
              lipFramesRef.current.push({ points: pts, landmarks, t });
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

  // Start/Stop recording with MIC + VIDEO (merge tracks)
  const toggleRecording = async () => {
    if (!videoRef.current) return;

    if (!isRecording) {
      // cleanup previous
      stopIsoPlayback();
      setRecordedUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
      setAudioUrl((u) => {
        if (u) URL.revokeObjectURL(u);
        return null;
      });
      recordedChunksRef.current = [];
      audioChunksRef.current = [];
      lipFramesRef.current = [];

      // 1) get mic
      try {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.error("Mic permission/stream failed:", err);
        setStatus("Microphone access required for audio playback");
        return;
      }

      // 2) get video track from current video element (MediaPipe Camera set this)
      const camStream = videoRef.current.srcObject as MediaStream | null;
      if (!camStream) {
        setStatus("No camera stream");
        return;
      }
      const videoTrack = camStream.getVideoTracks()[0];
      if (!videoTrack) {
        setStatus("No video track");
        return;
      }

      // 3) create separate video and audio streams
      const videoStream = new MediaStream([videoTrack]);
      const audioStream = micStreamRef.current;

      // 4) start video recorder
      const videoRecorder = new MediaRecorder(videoStream, { mimeType: "video/webm;codecs=vp8" });
      mediaRecorderRef.current = videoRecorder;

      videoRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      // 5) start audio recorder
      const audioRecorder = new MediaRecorder(audioStream, { mimeType: "audio/webm;codecs=opus" });
      audioRecorderRef.current = audioRecorder;

      audioRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      // 6) handle stop events
      let videoStopped = false;
      let audioStopped = false;

      const checkBothStopped = () => {
        if (videoStopped && audioStopped) {
          const videoBlob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          
          setRecordedUrl(URL.createObjectURL(videoBlob));
          setAudioUrl(URL.createObjectURL(audioBlob));
        }
      };

      videoRecorder.onstop = () => {
        videoStopped = true;
        checkBothStopped();
      };

      audioRecorder.onstop = () => {
        audioStopped = true;
        checkBothStopped();
      };

      recStartRef.current = performance.now(); // for frame timestamps
      recordingStartTimeRef.current = Date.now(); // actual recording start for sync
      videoRecorder.start(100); // collect chunks
      audioRecorder.start(100); // collect chunks

      setIsRecording(true);
      setStatus("Recording…");
    } else {
      mediaRecorderRef.current?.stop();
      audioRecorderRef.current?.stop();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      setIsRecording(false);
      setStatus("Recording stopped");
    }
  };

  // --- Isolated playback synced to audio ---
  const startIsoWithAudio = () => {
    if (!audioRef.current || lipFramesRef.current.length === 0) return;
    
    // Calibrate sync before starting
    calibrateSync();
    
    // Ensure audio element has the recorded url
    audioRef.current.currentTime = 0;
    void audioRef.current.play().then(() => {
      setIsPlayingIso(true);
      setIsoIndex(0);
      tick();
    }).catch((e) => {
      console.error("Audio play blocked:", e);
    });
  };

  const pauseIso = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      void audioRef.current.play().then(() => {
        setIsPlayingIso(true);
        tick();
      });
    } else {
      audioRef.current.pause();
      setIsPlayingIso(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const stopIsoPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlayingIso(false);
    setIsoIndex(0);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  // Drive isoIndex off audio currentTime using RAF with improved sync
  const tick = () => {
    if (!audioRef.current) return;
    const audioMs = audioRef.current.currentTime * 1000 + syncOffset; // Apply sync offset
    const frames = lipFramesRef.current;
    if (frames.length === 0) return;

    // Find the best matching frame using interpolation
    let bestIndex = 0;
    let minDiff = Infinity;

    for (let i = 0; i < frames.length; i++) {
      const diff = Math.abs(frames[i].t - audioMs);
      if (diff < minDiff) {
        minDiff = diff;
        bestIndex = i;
      }
    }

    // Only update if the difference is significant to avoid jitter
    if (Math.abs(bestIndex - isoIndex) > 0 || minDiff < 50) {
      setIsoIndex(bestIndex);
    }

    if (!audioRef.current.paused && !audioRef.current.ended) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setIsPlayingIso(false);
    }
  };

  // Calibrate sync offset by finding the best alignment
  const calibrateSync = () => {
    if (!audioRef.current || lipFramesRef.current.length === 0) return;
    
    const audioDuration = audioRef.current.duration * 1000;
    const frameDuration = lipFramesRef.current[lipFramesRef.current.length - 1]?.t || 0;
    
    // Calculate potential offset
    const durationDiff = audioDuration - frameDuration;
    console.log(`Audio duration: ${audioDuration}ms, Frame duration: ${frameDuration}ms, Diff: ${durationDiff}ms`);
    
    // If there's a significant difference, we might need to adjust frame timestamps
    if (Math.abs(durationDiff) > 100) {
      console.warn(`Significant duration mismatch detected: ${durationDiff}ms`);
    }
  };

  // Draw the current isolated lips frame into iso canvas
  useEffect(() => {
    const c = isoCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, c.width, c.height);

    const frame = lipFramesRef.current[isoIndex];
    if (!frame) return;

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
  }, [isoIndex]);


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
    <div
      style={{
        padding: 20,
        fontFamily: "Inter, system-ui, sans-serif",
        background: "#0a0a0a",
        color: "#f3f3f3",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Lip Capture (Outline + Audio Playback)</h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>
        Record once — then play the isolated mouth outline synced with your recorded audio.
      </p>
      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 20 }}>Status: {status}</p>

      {/* Live camera + isolated mouth outline side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Live camera */}
        <div style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 14, marginBottom: 8, opacity: 0.9 }}>📹 Live Camera</div>

          <div
            style={{
              position: "relative",
              borderRadius: 8,
              overflow: "hidden",
              background: "#000",
              display: "inline-block",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={syncCanvasToVideo}
              style={{
                width: "640px",
                height: "480px",
                objectFit: "cover",
                transform: "scaleX(-1)", // mirror video
                display: "block",
              }}
            />
            <canvas
              ref={liveCanvasRef}
              width={640}
              height={480}
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                transform: "scaleX(-1)", // mirror canvas to match video
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                fontSize: 12,
                background: "rgba(0,0,0,0.5)",
                padding: "4px 8px",
                borderRadius: 6,
              }}
            >
              Live (green outline = lips)
            </div>
          </div>
        </div>

        {/* Isolated mouth outline + audio-synced playback */}
        <div style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 14, opacity: 0.9 }}>👄 Isolated Mouth Outline (Audio-synced)</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Frame {Math.min(isoIndex + 1, lipFramesRef.current.length)} / {lipFramesRef.current.length}
            </div>
          </div>

          <div
            style={{
              width: "100%",
              aspectRatio: "4/3",
              background: "#000",
              borderRadius: 8,
              display: "grid",
              placeItems: "center",
              position: "relative",
            }}
          >
            <canvas ref={isoCanvasRef} width={480} height={360} style={{ maxWidth: "100%" }} />
            {/* Hidden audio element that drives the timeline */}
            <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />
          </div>

          {/* Sync Controls */}
          <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Sync Offset (ms): 
              <input
                type="range"
                min="-500"
                max="500"
                step="10"
                value={syncOffset}
                onChange={(e) => setSyncOffset(Number(e.target.value))}
                style={{ width: 100 }}
              />
              <span style={{ minWidth: 40 }}>{syncOffset}ms</span>
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={() => setIsoIndex((i) => Math.max(0, i - 1))}
              disabled={isoIndex <= 0 || isPlayingIso}
              style={{
                padding: "8px 12px",
                background: isoIndex <= 0 || isPlayingIso ? "#1f2937" : "#374151",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: isoIndex <= 0 || isPlayingIso ? "not-allowed" : "pointer",
                fontSize: 14,
              }}
            >
              ⏮️ Prev
            </button>

            {!isPlayingIso ? (
              <button
                onClick={startIsoWithAudio}
                disabled={!audioUrl || lipFramesRef.current.length === 0}
                style={{
                  padding: "8px 12px",
                  background: !audioUrl || lipFramesRef.current.length === 0 ? "#1f2937" : "#3b82f6",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor:
                    !audioUrl || lipFramesRef.current.length === 0 ? "not-allowed" : "pointer",
                  fontSize: 14,
                }}
              >
                ▶️ Play (with audio)
              </button>
            ) : (
              <button
                onClick={pauseIso}
                style={{
                  padding: "8px 12px",
                  background: "#f59e0b",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                ⏸️ Pause
              </button>
            )}

            <button
              onClick={() => setIsoIndex((i) => Math.min(lipFramesRef.current.length - 1, i + 1))}
              disabled={isoIndex >= lipFramesRef.current.length - 1 || isPlayingIso}
              style={{
                padding: "8px 12px",
                background:
                  isoIndex >= lipFramesRef.current.length - 1 || isPlayingIso ? "#1f2937" : "#374151",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor:
                  isoIndex >= lipFramesRef.current.length - 1 || isPlayingIso
                    ? "not-allowed"
                    : "pointer",
                fontSize: 14,
              }}
            >
              ⏭️ Next
            </button>

            <button
              onClick={stopIsoPlayback}
              style={{
                padding: "8px 12px",
                background: "#6b7280",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              ⏹️ Stop
            </button>

            <div
              style={{
                flex: 1,
                height: 10,
                background: "#111827",
                borderRadius: 999,
                overflow: "hidden",
                marginLeft: 8,
              }}
            >
              <div
                style={{
                  width:
                    lipFramesRef.current.length > 0
                      ? `${((isoIndex + 1) / lipFramesRef.current.length) * 100}%`
                      : "0%",
                  height: "100%",
                  background: "#3b82f6",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
        <button
          onClick={toggleRecording}
          style={{
            padding: "10px 16px",
            background: isRecording ? "#ef4444" : "#22c55e",
            color: "#0a0a0a",
            fontWeight: 600,
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>
      </div>

      {/* Recorded video playback (optional, to preview the AV file directly) */}
      {recordedUrl && (
        <div style={{ marginTop: 20 }}>
          <div style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 12, maxWidth: 640 }}>
            <div style={{ fontSize: 14, marginBottom: 8, opacity: 0.9 }}>🎬 Recorded Video</div>
            <video src={recordedUrl} controls style={{ width: "100%", borderRadius: 8, background: "#000" }} />
            <div style={{ marginTop: 8 }}>
              <a
                href={recordedUrl}
                download="lip_recording.webm"
                style={{
                  padding: "8px 12px",
                  background: "#111827",
                  border: "1px solid #374151",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "#e5e7eb",
                  fontSize: 14,
                }}
              >
                ⬇️ Download .webm
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
