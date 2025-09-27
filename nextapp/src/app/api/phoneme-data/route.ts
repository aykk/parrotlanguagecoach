import { NextResponse } from "next/server";
import { extractPhonemeScores } from "../../../utils/parseAzure";

export async function POST(request: Request) {
  try {
    const azureResponse = await request.json();
    
    // Extract phoneme scores using your existing utility
    const phonemeScores = extractPhonemeScores(azureResponse);
    
    return NextResponse.json({ 
      success: true, 
      phonemeScores,
      metadata: {
        totalPhonemes: Object.keys(phonemeScores).length,
        averageScore: Object.values(phonemeScores).reduce((a, b) => a + b, 0) / Object.values(phonemeScores).length
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to process phoneme data: ${error?.message || String(error)}` 
      },
      { status: 500 }
    );
  }
}
