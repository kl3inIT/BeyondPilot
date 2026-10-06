"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api/client";
import { publicFileUrl, uploadFile } from "@/lib/storage/upload";

import { useFileSize } from "./solution-deck";
import { limits, type HeldImage } from "./solution-editor-state";

/** What the backend accepts as an image of a solution (storage › FilePurpose.SOLUTION_LOGO, SOLUTION_IMAGE). */
const accepted = ["image/png", "image/jpeg", "image/webp"];
const megabyte = 1024 * 1024;
const places = {
  logo: { purpose: "solution_logo", maxBytes: 2 * megabyte },
  cover: { purpose: "solution_image", maxBytes: 5 * megabyte },
  more: { purpose: "solution_image", maxBytes: 5 * megabyte },
} as const;

type Place = keyof typeof places;
type Problem = "type" | "size" | "failed";

/** Uploads an image for its place, or says why it cannot be one. */
async function store(file: File, place: Place): Promise<HeldImage | Problem> {
  if (!accepted.includes(file.type)) {
    return "type";
  }
  if (file.size > places[place].maxBytes) {
    return "size";
  }
  try {
    const stored = await uploadFile(file, places[place].purpose);
    return { fileId: stored.id, fileName: stored.fileName, sizeBytes: stored.sizeBytes };
  } catch (error) {
    const code = error instanceof ApiError ? error.code : undefined;
    return code === "STORAGE_MEDIA_TYPE_NOT_ALLOWED" || code === "STORAGE_CONTENT_MISMATCH"
      ? "type"
      : code === "STORAGE_FILE_TOO_LARGE"
        ? "size"
        : "failed";
  }
}

const tileVariants = cva(
  "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted text-muted-foreground",
  {
    variants: {
      place: {
        logo: "size-18",
        cover: "aspect-video w-40",
        more: "h-24 w-34",
      },
      /** Empty tiles are the control that adds an image. */
      empty: {
        true: "border-dashed border-input bg-background transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-invalid:border-destructive",
        false: "",
      },
    },
    defaultVariants: { empty: false },
  },
);

type TileProps = Required<Pick<VariantProps<typeof tileVariants>, "place">>;

/** The tile of an upload on its way. */
function UploadingTile({ place, label }: TileProps & { label: string }) {
  return (
    <div role="status" className={tileVariants({ place })}>
      <span className="flex flex-col items-center gap-1 text-xs">
        <Spinner />
        {place !== "logo" && label}
        {place === "logo" && <span className="sr-only">{label}</span>}
      </span>
    </div>
  );
}

type ImageUploadProps = {
  /** The id of the control that chooses a file, so a link from another step reaches it. */
  id: string;
  place: "logo" | "cover";
  image: HeldImage | null;
  /** True when a review asks for this image and it is not there. */
  invalid?: boolean;
  /** The ids of the hint and the error drawn under the field. */
  describedBy?: string;
  onChange: (image: HeldImage | null) => void;
};

/**
 * One image of a solution, its logo or its cover: uploaded at once and named by the solution with
 * its next save. The backend removes an image the solution no longer names.
 */
function ImageUpload({ id, place, image, invalid, describedBy, onChange }: ImageUploadProps) {
  const t = useTranslations("Solution.editor.images");
  const size = useFileSize();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [dimensions, setDimensions] = useState<{ fileId: string; text: string } | null>(null);

  async function upload(file: File) {
    setProblem(null);
    setUploading(true);
    const stored = await store(file, place);
    setUploading(false);
    if (input.current) {
      input.current.value = "";
    }
    if (typeof stored === "string") {
      setProblem(stored);
    } else {
      onChange(stored);
    }
  }

  const choose = () => input.current?.click();
  const measured = image && dimensions?.fileId === image.fileId ? dimensions.text : null;

  return (
    <div data-slot="image-upload" data-place={place} className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept={accepted.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void upload(file);
          }
        }}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {uploading ? (
          <UploadingTile place={place} label={t("uploading")} />
        ) : image ? (
          <div className={tileVariants({ place })}>
            <Image
              src={publicFileUrl(image.fileId)}
              alt={t(`${place}.alt`)}
              fill
              sizes="160px"
              unoptimized
              className={place === "logo" ? "object-contain" : "object-cover"}
              onLoad={(event) =>
                setDimensions({
                  fileId: image.fileId,
                  text: `${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`,
                })
              }
            />
          </div>
        ) : (
          <button
            id={id}
            type="button"
            onClick={choose}
            aria-label={t(`${place}.add`)}
            data-invalid={invalid || problem ? true : undefined}
            aria-describedby={describedBy}
            className={tileVariants({ place, empty: true })}
          >
            <PlusIcon className="size-5" aria-hidden="true" />
          </button>
        )}
        {image && !uploading && (
          <>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{image.fileName}</span>
              <span className="text-xs text-muted-foreground">
                {measured
                  ? t("details", { size: size(image.sizeBytes), dimensions: measured })
                  : size(image.sizeBytes)}
              </span>
            </div>
            <div className="flex gap-1">
              <Button
                id={id}
                prominence="tertiary"
                size="sm"
                aria-label={t("replaceNamed", { name: image.fileName })}
                onClick={choose}
              >
                {t("replace")}
              </Button>
              <Button
                prominence="tertiary"
                size="sm"
                aria-label={t("removeNamed", { name: image.fileName })}
                onClick={() => onChange(null)}
              >
                {t("remove")}
              </Button>
            </div>
          </>
        )}
      </div>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem === "size" ? t(`errors.size.${place}`) : t(`errors.${problem}`)}
        </p>
      )}
    </div>
  );
}

type GalleryUploadProps = {
  id: string;
  images: HeldImage[];
  /** Adds an image whose upload ended; uploads end one by one, each after the list may have changed. */
  onAdd: (image: HeldImage) => void;
  onChange: (images: HeldImage[]) => void;
};

/**
 * The images shown under the cover: up to four, in the order a person gives them by dragging a tile
 * or with the arrows on it.
 */
function GalleryUpload({ id, images, onAdd, onChange }: GalleryUploadProps) {
  const t = useTranslations("Solution.editor.images");
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [dragged, setDragged] = useState<number | null>(null);
  const [moved, setMoved] = useState("");
  const room = limits.images - images.length - uploading;

  async function upload(files: File[]) {
    setProblem(null);
    const taken = files.slice(0, room);
    setUploading((count) => count + taken.length);
    // One after the other, so the images keep the order they were chosen in.
    for (const file of taken) {
      const stored = await store(file, "more");
      setUploading((count) => count - 1);
      if (typeof stored === "string") {
        setProblem(stored);
      } else {
        onAdd(stored);
      }
    }
    if (input.current) {
      input.current.value = "";
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length || from === to) {
      return;
    }
    const next = [...images];
    const [image] = next.splice(from, 1);
    next.splice(to, 0, image);
    onChange(next);
    setMoved(t("more.moved", { position: to + 1, count: next.length }));
  }

  return (
    <div data-slot="gallery-upload" className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        multiple
        accept={accepted.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          if (files.length > 0) {
            void upload(files);
          }
        }}
      />
      <ul className="flex flex-wrap gap-3">
        {images.map((image, index) => (
          <li
            key={image.fileId}
            draggable
            onDragStart={() => setDragged(index)}
            onDragEnd={() => setDragged(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (dragged !== null) {
                move(dragged, index);
              }
              setDragged(null);
            }}
            data-dragged={dragged === index ? true : undefined}
            className="group/tile relative data-dragged:opacity-50"
          >
            <div className={tileVariants({ place: "more" })}>
              <Image
                src={publicFileUrl(image.fileId)}
                alt={t("more.alt", { position: index + 1, count: images.length })}
                fill
                sizes="140px"
                unoptimized
                className="object-cover"
              />
            </div>
            {/* Always there for a keyboard and a touch screen; a mouse sees them on the tile it is over. */}
            <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-0 transition-opacity group-focus-within/tile:opacity-100 group-hover/tile:opacity-100 pointer-coarse:opacity-100">
              <span className="flex gap-1">
                <TileAction
                  label={t("more.earlier", { position: index + 1 })}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ChevronLeftIcon aria-hidden="true" />
                </TileAction>
                <TileAction
                  label={t("more.later", { position: index + 1 })}
                  disabled={index === images.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ChevronRightIcon aria-hidden="true" />
                </TileAction>
              </span>
              <TileAction
                label={t("more.remove", { position: index + 1 })}
                onClick={() => onChange(images.filter((_, at) => at !== index))}
              >
                <XIcon aria-hidden="true" />
              </TileAction>
            </div>
          </li>
        ))}
        {Array.from({ length: uploading }, (_, index) => (
          <li key={`uploading-${index}`}>
            <UploadingTile place="more" label={t("uploading")} />
          </li>
        ))}
        {room > 0 && (
          <li>
            <button
              id={id}
              type="button"
              onClick={() => input.current?.click()}
              className={tileVariants({ place: "more", empty: true })}
            >
              <span className="flex flex-col items-center gap-1 text-xs">
                <PlusIcon className="size-5" aria-hidden="true" />
                {t("more.add")}
              </span>
            </button>
          </li>
        )}
      </ul>
      <p aria-live="polite" className="sr-only">
        {moved}
      </p>
      {problem && (
        <p role="alert" className="text-sm text-destructive">
          {problem === "size" ? t("errors.size.more") : t(`errors.${problem}`)}
        </p>
      )}
    </div>
  );
}

type TileActionProps = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

/** A small control on an image tile, named for a reader who cannot see its icon. */
function TileAction({ label, disabled, onClick, children }: TileActionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="hit-area flex size-6 items-center justify-center rounded-md border bg-background text-foreground shadow-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 [&_svg]:size-3.5"
    >
      {children}
    </button>
  );
}

export { GalleryUpload, ImageUpload };
