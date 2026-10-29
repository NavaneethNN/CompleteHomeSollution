"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Star,
  AlertCircle,
  ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { imageUploadError, IMAGE_UPLOAD_LIMIT_LABEL } from "@/lib/upload-policy";

interface UploadingFile {
  name: string;
  progress: "uploading" | "done" | "error";
  error?: string;
}

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  folder?: string;
  compact?: boolean;
}

export function ImageUploader({
  images,
  onChange,
  maxImages = 10,
  folder = "products",
  compact = false,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const canAddMore = images.length < maxImages;

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const currentImages = imagesRef.current;
      const allowed = maxImages - currentImages.length;
      const toUpload = files.slice(0, allowed);
      if (toUpload.length === 0) {
        toast.error(`Maximum ${maxImages} images allowed`);
        return;
      }
      if (files.length > allowed) {
        toast.warning(`Only ${allowed} more image(s) can be added. Uploading first ${allowed}.`);
      }

      const validFiles: File[] = [];
      for (const file of toUpload) {
        const error = imageUploadError(file);
        if (error) {
          toast.error(`${file.name}: ${error}`);
          continue;
        }
        validFiles.push(file);
      }
      if (validFiles.length === 0) return;

      setUploading(validFiles.map((f) => ({ name: f.name, progress: "uploading" })));

      const uploadedUrls: string[] = [];

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        try {
          const form = new FormData();
          form.append("file", file);
          form.append("folder", folder);

          const res = await fetch("/api/upload", {
            method: "POST",
            body: form,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(res.status === 413 ? "Image is too large. Please resize it to under 4 MB and try again." : err.error ?? "Upload failed. Please try again.");
          }

          const { publicUrl } = await res.json();
          
          // Validate the public URL
          if (!publicUrl) {
            throw new Error("Server returned empty image URL. Check R2_PUBLIC_URL environment variable.");
          }
          
          uploadedUrls.push(publicUrl);
          setUploading((prev) =>
            prev.map((u, idx) => (idx === i ? { ...u, progress: "done" } : u))
          );
        } catch (err) {
          setUploading((prev) =>
            prev.map((u, idx) =>
              idx === i ? { ...u, progress: "error", error: (err as Error).message } : u
            )
          );
          toast.error(`Failed to upload ${file.name}: ${(err as Error).message}`);
        }
      }

      if (uploadedUrls.length > 0) {
        onChange([...imagesRef.current, ...uploadedUrls]);
        toast.success(`${uploadedUrls.length} image${uploadedUrls.length > 1 ? "s" : ""} uploaded`);
      }

      setUploading(prev => prev.filter(file => file.progress === "error"));
    },
    [maxImages, folder, onChange]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      uploadFiles(files);
    },
    [uploadFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length) uploadFiles(files);
    },
    [uploadFiles]
  );

  const removeImage = (index: number) => onChange(images.filter((_, i) => i !== index));

  const moveImage = (from: number, to: number) => {
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {/* Hidden file input — always mounted so any trigger button works reliably */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Upload area — shown when no images are added yet */}
      {images.length === 0 && canAddMore && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
            compact ? "p-4" : "p-8",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-slate-200 bg-slate-50 hover:border-primary/50 hover:bg-slate-100"
          )}
        >
          {uploading.some(file => file.progress === "uploading") ? (
            <Loader2 className={cn("animate-spin text-primary", compact ? "h-6 w-6" : "h-8 w-8")} />
          ) : (
            <div className={cn("flex items-center justify-center rounded-xl bg-slate-200", compact ? "h-9 w-9" : "h-12 w-12")}>
              <Upload className={cn("text-slate-500", compact ? "h-4 w-4" : "h-6 w-6")} />
            </div>
          )}
          <div className="text-center">
            <p className={cn("font-medium text-slate-700", compact ? "text-xs" : "text-sm")}>
              {uploading.some(file => file.progress === "uploading") ? "Uploading to storage..." : "Click or drag images here"}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              JPEG, PNG, WebP, AVIF, GIF · Max {IMAGE_UPLOAD_LIMIT_LABEL} · Up to {maxImages} images
            </p>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploading.length > 0 && (
        <div className="space-y-1.5">
          {uploading.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs">
              {f.progress === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
              {f.progress === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
              {f.progress === "error" && <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
              <span className="truncate text-slate-600">{f.name}</span>
              {f.progress === "uploading" && <span className="ml-auto text-slate-400">Uploading…</span>}
              {f.progress === "done" && <span className="ml-auto text-emerald-600">Done</span>}
              {f.progress === "error" && <span className="ml-auto text-red-500">{f.error ?? "Failed"}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Image grid — displayed when images exist */}
      {images.length > 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "grid gap-2.5 rounded-lg transition-colors",
            compact ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5",
            dragOver && "ring-2 ring-primary ring-offset-2 bg-primary/5"
          )}
        >
          {images.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
            >
              {/* Image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={url} 
                alt="" 
                className="h-full w-full object-cover"
                onError={(e) => {
                  console.error(`[ImageUploader] Failed to load image: ${url}`);
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="%23f0f0f0"/><text x="50" y="50" text-anchor="middle" fill="%23999" font-size="12">Error</text></svg>';
                }}
              />

              {/* First image badge */}
              {index === 0 && (
                <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                  Main
                </span>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="flex gap-1">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => moveImage(index, index - 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-slate-700 hover:bg-white transition-colors"
                      title="Move left"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {index < images.length - 1 && (
                    <button
                      type="button"
                      onClick={() => moveImage(index, index + 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-slate-700 hover:bg-white transition-colors"
                      title="Move right"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Index number */}
              <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[10px] font-medium text-white">
                {index + 1}
              </span>
            </div>
          ))}

          {/* Add more tile inside the grid */}
          {canAddMore && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:border-primary/50 hover:bg-slate-100 hover:text-primary transition-colors cursor-pointer"
              title="Add more images"
            >
              <ImageIcon className={cn(compact ? "h-5 w-5" : "h-6 w-6")} />
              <span className="text-xs font-medium">Add</span>
            </button>
          )}
        </div>
      )}

      {images.length > 0 && (
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>First image is used as the main image. Use arrows to reorder.</span>
          <span>{images.length}/{maxImages} images</span>
        </div>
      )}
    </div>
  );
}
