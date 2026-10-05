import type { NextRequest } from "next/server";

import { robotsTxt } from "@/lib/robots";

export function GET(request: NextRequest) {
  return new Response(robotsTxt(request.headers.get("host")), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
