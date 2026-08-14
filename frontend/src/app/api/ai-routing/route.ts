import { NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "https://back-mp9k.onrender.com";

export async function GET() {
  try {
    const r = await fetch(`${BACKEND}/ai-routing`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const data = await r.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch AI routing data", detail: err?.message },
      { status: 502 }
    );
  }
}
