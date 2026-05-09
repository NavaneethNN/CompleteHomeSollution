"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      if (images.length + files.length > maxImages) {
        setUploadError(`Maximum ${maxImages} images allowed`);
        return;
      }

      setIsUploading(true);
      setUploadError(null);

      const uploadedUrls: string[] = [];

      for (const file of Array.from(files)) {
        try {
          // Get presigned URL from server
          const response = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name,
              contentType: file.type,
              folder,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to get upload URL");
          }

          const { uploadUrl, key } = await response.json();

          // Upload file directly to R2
          const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });

          if (!uploadResponse.ok) {
            throw new Error("Failed to upload file");
          }

          // Construct public URL
          const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
          uploadedUrls.push(publicUrl);
        } catch (error) {
          console.error("Upload error:", error);
          setUploadError(`Failed to upload ${file.name}`);
        }
      }

      if (uploadedUrls.length > 0) {
        onChange([...images, ...uploadedUrls]);
      }

      setIsUploading(false);
      e.target.value = ""; // Reset input
    },
    [images, maxImages, folder, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(images.filter((_, i) => i !== index));
    },
    [images, onChange]
  );

  const handleReorder = useCallback(
    (dragIndex: number, dropIndex: number) => {
      const newImages = [...images];
      const [dragged] = newImages.splice(dragIndex, 1);
      newImages.splice(dropIndex, 0, dragged);
      onChange(newImages);
    },
    [images, onChange]
  );

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {uploadError && (
        <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg">
          {uploadError}
        </div>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="relative aspect-square bg-muted rounded-lg overflow-hidden group"
            >
              <Image
                src={url}
                alt={`Product image ${index + 1}`}
                fill
                className="object-cover"
                sizes="150px"
              />
              
              {/* Overlay with actions */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {index > 0 && (
                  <button
                    onClick={() => handleReorder(index, index - 1)}
                    className="p-2 bg-white rounded-full hover:bg-gray-100"
                    title="Move left"
                  >
                    ←
                  </button>
                )}
                <button
                  onClick={() => handleRemove(index)}
                  className="p-2 bg-white text-destructive rounded-full hover:bg-gray-100"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
                {index < images.length - 1 && (
                  <button
                    onClick={() => handleReorder(index, index + 1)}
                    className="p-2 bg-white rounded-full hover:bg-gray-100"
                    title="Move right"
                  >
                    →
                  </button>
                )}
              </div>

              {/* Image number badge */}
              <span className="absolute top-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                {index + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {images.length < maxImages && (
        <label
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
            isUploading
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted"
          )}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
          />
          
          {isUploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-primary">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Click to upload images ({images.length}/{maxImages})
              </span>
            </>
          )}
        </label>
      )}
    </div>
  );
}
