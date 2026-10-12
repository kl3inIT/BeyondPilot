// Spring owns /api, and in deployed environments the reverse proxy sends a browser's /api requests
// there. The image optimizer is the exception: it reads `/_next/image?url=/api/storage/files/…` by
// asking this server itself, which on its own has no /api. This route answers that internal read
// with the backend's file, so stored logos and covers reach phones resized and in WebP.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: RouteContext<"/api/storage/files/[id]">) {
  const { id } = await params;
  const origin = process.env.BEYONDPILOT_API_ORIGIN;
  if (!origin || !uuid.test(id)) {
    return new Response(null, { status: 404 });
  }
  // The S3 store answers with a redirect to the bucket, which fetch follows.
  const file = await fetch(`${origin}/api/storage/files/${id}`, { cache: "no-store" });
  if (!file.ok || !file.body) {
    return new Response(null, { status: file.status === 404 ? 404 : 502 });
  }
  const headers = new Headers({ "Content-Type": file.headers.get("Content-Type") ?? "" });
  // The backend marks a file immutable; the optimizer keeps its resized copies as long.
  const cacheControl = file.headers.get("Cache-Control");
  if (cacheControl) headers.set("Cache-Control", cacheControl);
  return new Response(file.body, { headers });
}
