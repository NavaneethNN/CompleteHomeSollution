"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  X,
  Loader2,
  Link as LinkIcon,
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
}

export function ImageUploader({
  images,
  onChange,
  maxImages = 10,
  folder = "products",
}: ImageUploaderProps) {
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canAddMore = images.length < maxImages;

  const uploadFiles = useCallback(
    async (files: File[]) => {
      const allowed = maxImages - images.length;
      const toUpload = files.slice(0, allowed);
      if (toUpload.length === 0) {
        toast.error(`Maximum ${maxImages} images allowed`);
        return;
      }
      if (files.length > allowed) {
        toast.warning(`Only ${allowed} more image(s) can be added. Uploading first ${allowed}.`);
      }

      const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
      const MAX_SIZE = 5 * 1024 * 1024;

      const validFiles: File[] = [];
      for (const file of toUpload) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error(`${file.name}: unsupported type. Use JPEG, PNG, WebP, or GIF.`);
          continue;
        }
        if (file.size > MAX_SIZE) {
          toast.error(`${file.name}: exceeds 5 MB limit.`);
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
            throw new Error(err.error ?? `Server error ${res.status}`);
          }

          const { publicUrl, key } = await res.json();
          
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
        onChange([...images, ...uploadedUrls]);
        toast.success(`${uploadedUrls.length} image${uploadedUrls.length > 1 ? "s" : ""} uploaded`);
      }

      setTimeout(() => setUploading([]), 1500);
    },
    [images, maxImages, folder, onChange]
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

  const handleAddUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      toast.error("Enter a valid URL (must start with http:// or https://)");
      return;
    }
    if (images.includes(url)) {
      toast.error("This URL is already added");
      return;
    }
    if (!canAddMore) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }
    onChange([...images, url]);
    setUrlInput("");
    toast.success("Image URL added");
  };

  const removeImage = (index: number) => onChange(images.filter((_, i) => i !== index));

  const moveImage = (from: number, to: number) => {
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 gap-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            tab === "upload"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Upload className="h-3.5 w-3.5" />
          Upload Files
        </button>
        <button
          type="button"
          onClick={() => setTab("url")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            tab === "url"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <LinkIcon className="h-3.5 w-3.5" />
          Paste URL
        </button>
      </div>

      {/* Upload area */}
      {tab === "upload" && canAddMore && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-slate-200 bg-slate-50 hover:border-primary/50 hover:bg-slate-100"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
          {uploading.length > 0 ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200">
              <Upload className="h-6 w-6 text-slate-500" />
            </div>
          )}
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">
              {uploading.length > 0 ? "Uploading to Cloudflare R2..." : "Click or drag images here"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              JPEG, PNG, WebP, GIF · Max 5 MB each · Up to {maxImages} images
            </p>
          </div>
          <p className="text-xs text-slate-400">
            {images.length}/{maxImages} added
          </p>
        </div>
      )}

      {/* Upload progress */}
      {uploading.length > 0 && (
        <div className="space-y-1.5">
          {uploading.map((f, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
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

      {/* URL input */}
      {tab === "url" && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
              placeholder="https://example.com/image.jpg"
              className="pl-9"
              disabled={!canAddMore}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleAddUrl}
            disabled={!urlInput.trim() || !canAddMore}
          >
            Add
          </Button>
        </div>
      )}

      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
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

          {/* Add more tile */}
          {canAddMore && tab === "upload" && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:border-primary/50 hover:bg-slate-100 hover:text-primary transition-colors"
              title="Add more images"
            >
              <ImageIcon className="h-6 w-6" />
              <span className="text-xs">Add</span>
            </button>
          )}
        </div>
      )}

      {images.length > 0 && (
        <p className="text-xs text-slate-400">
          First image is used as the main product image. Use arrows to reorder.
        </p>
      )}
    </div>
  );
}
