import { NextResponse } from "next/server";

export async function GET() {
  try {
    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;

    if (!key || !region) {
      return NextResponse.json(
        { error: "Missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION" },
        { status: 500 }
      );
    }

    const url = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "",
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Azure token fetch failed: ${res.status} ${text}` },
        { status: 500 }
      );
    }

    const token = await res.text();
    return NextResponse.json({ token, region });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Server error: ${err?.message || String(err)}` },
      { status: 500 }
    );
  }
}
