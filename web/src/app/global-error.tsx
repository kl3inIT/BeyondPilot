"use client";

import "./globals.css";

// Replaces the root layout when it fails, so no translation provider exists here.
// This is the one screen whose copy is written in both languages inline.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-full flex-col bg-background text-foreground antialiased">
        <title>BeyondPilot</title>
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
          <h1 className="text-3xl font-semibold tracking-tight">
            Something went wrong · Đã có lỗi xảy ra
          </h1>
          <p className="text-muted-foreground">Please try again. · Vui lòng thử lại.</p>
          {error.digest ? (
            <p className="text-sm text-muted-foreground">
              Reference · Mã tham chiếu: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            className="w-fit rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => retry()}
          >
            Try again · Thử lại
          </button>
        </main>
      </body>
    </html>
  );
}
