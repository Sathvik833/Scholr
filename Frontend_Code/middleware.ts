import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Simple demo protection using HTTP Basic Auth.
 * Set DEMO_PASSWORD in your environment (Vercel + local .env.local).
 * Username is fixed as "demo".
 */
export function middleware(req: NextRequest) {
  const demoPassword = process.env.DEMO_PASSWORD;

  // If no password is configured, skip protection (safe for local dev setup phase).
  if (!demoPassword) {
    return NextResponse.next();
  }

  const authHeader = req.headers.get("authorization");

  if (authHeader?.startsWith("Basic ")) {
    try {
      const encoded = authHeader.slice(6);
      const decoded = atob(encoded);
      const [username, password] = decoded.split(":", 2);

      if (username === "demo" && password === demoPassword) {
        return NextResponse.next();
      }
    } catch {
      // Fall through to unauthorized response below.
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Scholr Demo", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}

export const config = {
  matcher: [
    /*
     * Protect all app routes, exclude static assets and common metadata files.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
