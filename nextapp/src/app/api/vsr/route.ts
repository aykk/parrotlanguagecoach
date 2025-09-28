// app/api/vsr/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VSR_URL = process.env.LIPREAD_SERVICE_URL || ""; // e.g. http://localhost:8000/vsr
const VSR_API_KEY = process.env.LIPREAD_SERVICE_KEY || ""; // optional, if your backend requires it

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Optional CORS (helpful if you ever call this route cross-origin)
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(req: Request) {
  try {
    // Ensure multipart form
    const ct = req.headers.get("content-type") || "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return json({ error: "Content-Type must be multipart/form-data" }, 415);
    }

    const inFd = await req.formData();
    const clip = inFd.get("clip");
    const frame = inFd.get("frame");

    if (!(clip instanceof File) && !(frame instanceof File)) {
      return json({ error: "Provide either 'clip' (webm/mp4) or 'frame' (jpg/png)" }, 400);
    }

    // If no backend configured yet → return a safe stub so the UI keeps working
    if (!VSR_URL) {
      return json({
        ok: true,
        // Keep this shape consistent with your frontend expectations
        text: "",
        phonemes: [],
        tokens: [],
        note: "VSR backend not configured. Set LIPREAD_SERVICE_URL to enable.",
      });
    }

    // Repack to forward only the relevant file (clip preferred)
    const outFd = new FormData();
    if (clip instanceof File) {
      outFd.append("clip", clip, (clip as any).name || "mouth.webm");
    } else if (frame instanceof File) {
      outFd.append("frame", frame, (frame as any).name || "f.jpg");
    }

    // Pass-through optional knobs if you included them on the client (fps/size/etc.)
    // Example:
    // for (const k of ["fps", "size", "lang"]) {
    //   const v = inFd.get(k);
    //   if (typeof v === "string") outFd.append(k, v);
    // }

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 30_000); // 30s timeout

    const headers: Record<string, string> = {};
    if (VSR_API_KEY) headers["Authorization"] = `Bearer ${VSR_API_KEY}`;

    const upstream = await fetch(VSR_URL, {
      method: "POST",
      body: outFd,
      headers,
      signal: controller.signal,
    }).catch((e) => {
      throw new Error(`VSR fetch error: ${String(e?.message || e)}`);
    });
    clearTimeout(to);

    // Normalize response to JSON your UI can use
    const respCT = upstream.headers.get("content-type") || "";
    if (!upstream.ok) {
      const msg = respCT.includes("application/json")
        ? await upstream.json().catch(() => ({}))
        : await upstream.text().catch(() => "");
      return json(
        { error: `VSR ${upstream.status}`, detail: msg || "upstream error" },
        502
      );
    }

    if (respCT.includes("application/json")) {
      const data = await upstream.json();
      // Ensure minimal shape
      return json({
        ok: true,
        text: data?.text ?? "",
        phonemes: data?.phonemes ?? [],
        tokens: data?.tokens ?? [],
        raw: data, // keep raw so you can debug/model-specific fields
      });
    } else {
      // Backend returned plain text (treat as transcript)
      const text = await upstream.text();
      return json({ ok: true, text: text || "", phonemes: [], tokens: [] });
    }
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "VSR request timed out" : err?.message || "server error";
    return json({ error: msg }, err?.name === "AbortError" ? 504 : 500);
  }
}
