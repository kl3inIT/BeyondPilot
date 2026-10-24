"use client";

import { useEffect, useState } from "react";

import { publicFileUrl } from "@/lib/storage/upload";

/** How much white the tint mixes into the logo's colour, so dark text stays readable on it. */
const WHITE_MIX = 0.86;

/** The tints already read, by file, so a logo is decoded once a session; `null` when none was usable. */
const tints = new Map<string, string | null>();

/**
 * The colour of a logo that stands for it: the most frequent of its vivid colours, near white and
 * near black left out, mixed toward white. Dub's marketplace tints its cards the same way.
 */
function tintOf(image: HTMLImageElement): string | null {
  const side = 32;
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }
  context.drawImage(image, 0, 0, side, side);
  const pixels = context.getImageData(0, 0, side, side).data;
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (let index = 0; index < pixels.length; index += 4) {
    const [r, g, b, alpha] = [
      pixels[index],
      pixels[index + 1],
      pixels[index + 2],
      pixels[index + 3],
    ];
    if (alpha < 125 || (r > 232 && g > 232 && b > 232) || (r < 24 && g < 24 && b < 24)) {
      continue;
    }
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  let best: [number, number, number] | null = null;
  let bestScore = -1;
  for (const bucket of buckets.values()) {
    const colour: [number, number, number] = [
      bucket.r / bucket.count,
      bucket.g / bucket.count,
      bucket.b / bucket.count,
    ];
    const max = Math.max(...colour);
    const saturation = max === 0 ? 0 : (max - Math.min(...colour)) / max;
    // A vivid colour wins over a merely frequent muddy one.
    const score = bucket.count * (0.2 + saturation);
    if (score > bestScore) {
      bestScore = score;
      best = colour;
    }
  }
  if (!best) {
    return null;
  }
  const [r, g, b] = best.map((channel) => Math.round(channel + (255 - channel) * WHITE_MIX));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * What a card shows in the frame of a solution with no cover: its logo large, on a tint of its own
 * colour, so every card of a row keeps the same frame. Without a logo the frame stays plain.
 */
function SolutionLogoCover({ fileId }: { fileId?: string | null }) {
  const [tint, setTint] = useState<string | null>(() =>
    fileId ? (tints.get(fileId) ?? null) : null,
  );

  useEffect(() => {
    if (!fileId || tints.has(fileId)) {
      return;
    }
    let cancelled = false;
    const image = new Image();
    const finish = (found: string | null) => {
      tints.set(fileId, found);
      if (!cancelled) {
        setTint(found);
      }
    };
    image.onload = () => {
      try {
        finish(tintOf(image));
      } catch {
        finish(null);
      }
    };
    image.onerror = () => finish(null);
    image.src = publicFileUrl(fileId);
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center bg-(--tint,transparent) transition-colors duration-500"
      style={tint ? ({ "--tint": tint } as React.CSSProperties) : undefined}
    >
      {fileId && (
        // A plain img: the logo is drawn at its own small size, and multiply lets its white ground take the tint.
        <img
          src={publicFileUrl(fileId)}
          alt=""
          loading="lazy"
          className="h-14 max-w-3/5 object-contain mix-blend-multiply"
        />
      )}
    </div>
  );
}

export { SolutionLogoCover };
