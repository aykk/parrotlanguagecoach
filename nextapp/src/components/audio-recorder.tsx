"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Mic, Play, Square, Loader2 } from "lucide-react"

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void
  onRecordingStart?: () => void
  isAnalyzing: boolean
}

export function AudioRecorder({ onRecordingComplete, onRecordingStart, isAnalyzing }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const animationRef = useRef<number | null>(null)
  const isRecordingRef = useRef(false)

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (audioContextRef.current) audioContextRef.current.close()
    }
  }, [])



  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      })

      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      analyserRef.current.fftSize = 256
      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const updateAudioLevel = () => {
        if (analyserRef.current && isRecordingRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / bufferLength
          setAudioLevel(average)
          animationRef.current = requestAnimationFrame(updateAudioLevel)
        }
      }

      mediaRecorderRef.current = new MediaRecorder(stream)
      const chunks: Blob[] = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        chunks.push(event.data)
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/wav" })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        onRecordingComplete(blob)
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      isRecordingRef.current = true
      setRecordingTime(0)
      updateAudioLevel()

      if (onRecordingStart) {
        onRecordingStart()
      }

      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (error) {
      console.error("Error accessing microphone:", error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      isRecordingRef.current = false
      setAudioLevel(0)

      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }

      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    } else {
      console.log("[v0] Cannot stop recording - conditions not met")
    }
  }

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const playRecording = () => {
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      audio.play()
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="w-5 h-5" />
          Record Your Pronunciation
        </CardTitle>
        <CardDescription>Click the microphone to start recording, then read the sentence clearly</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <Button
              size="lg"
              variant={isRecording ? "destructive" : "default"}
              className="w-20 h-20 rounded-full relative z-10"
              onClick={handleButtonClick}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              disabled={false}
              style={{ pointerEvents: "auto" }}
            >
              {isRecording ? <Square className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </Button>

            {isRecording && (
              <div
                className="absolute -inset-2 rounded-full border-2 border-primary animate-pulse pointer-events-none"
                style={{
                  transform: `scale(${1 + audioLevel / 500})`,
                  opacity: 0.6,
                }}
              />
            )}
          </div>

          <div className="text-center">
            {isRecording ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">Recording... (Click to stop)</p>
                <p className="text-lg font-mono">{formatTime(recordingTime)}</p>
              </div>
            ) : audioBlob ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-success">Recording Complete</p>
                <Button variant="outline" size="sm" onClick={playRecording}>
                  <Play className="w-4 h-4 mr-2" />
                  Play Recording
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Click to start recording</p>
            )}
          </div>
        </div>

        {isRecording && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Audio Level</p>
            <Progress value={Math.min(audioLevel * 2, 100)} className="h-2" />
          </div>
        )}

        {isAnalyzing && (
          <div className="flex items-center justify-center space-x-2 p-4 bg-muted rounded-lg">
            <Loader2 className="w-5 h-5 animate-spin" />
            <p className="text-sm font-medium">Analyzing your pronunciation...</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
