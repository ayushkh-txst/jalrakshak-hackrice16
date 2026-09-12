import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "";
  const origin = request.nextUrl.origin;

  // Extract provider from state (e.g. "provider=github" -> "github")
  const stateParams = new URLSearchParams(state);
  const provider = stateParams.get("provider") || "google";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=NoCodeProvided`);
  }

  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const response = await fetch(`${backendUrl}/auth/${provider}/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error(`Backend ${provider} authentication failed`);
    }

    const data = await response.json();

    return NextResponse.redirect(`${origin}/dashboard`);
  } catch (error) {
    console.error("OAuth error:", error);
    return NextResponse.redirect(`${origin}/login?error=OAuthFailed`);
  }
}