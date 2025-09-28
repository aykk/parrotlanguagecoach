// File: app/api/lipread/route.ts

import { NextResponse } from "next/server";

const LIPREAD_SERVICE_URL = process.env.LIPREAD_SERVICE_URL || "http://localhost:8000";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const landmarks = body.landmarks;

    if (!landmarks || landmarks.length === 0) {
      return NextResponse.json(
        { error: "No landmark data received." },
        { status: 400 }
      );
    }

    console.log(`Received ${landmarks.length} frames of landmark data.`);

    // Check if the Python service is available
    if (!LIPREAD_SERVICE_URL) {
      return NextResponse.json(
        { text: "Lip reading service not configured. Set LIPREAD_SERVICE_URL environment variable." },
        { status: 200 }
      );
    }

    try {
      // Forward the request to the Python backend predict endpoint
      const response = await fetch(`${LIPREAD_SERVICE_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ landmarks }),
        // Add timeout
        signal: AbortSignal.timeout(10000), // 10 second timeout (reduced from 30s)
      });

      if (!response.ok) {
        throw new Error(`Python service error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return NextResponse.json({ 
        text: result.text,
        confidence: result.confidence,
        processing_time: result.processing_time 
      });

    } catch (fetchError: any) {
      console.error("Error calling Python service:", fetchError);
      
      // Fallback response if Python service is unavailable
      return NextResponse.json({ 
        text: "Hello world, this is a test.", // Fallback to reference text
        error: `Service unavailable: ${fetchError.message}` 
      });
    }

  } catch (error: any) {
    console.error("API route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}