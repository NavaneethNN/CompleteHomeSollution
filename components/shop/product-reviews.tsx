"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { Star, X, Loader2, Camera, CheckCircle2, LogIn, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  images: string[];
  createdAt: Date;
  user: {
    name: string | null;
    image: string | null;
  };
}

interface ProductReviewsProps {
  productId: string;
  reviews: Review[];
  reviewCount: number;
}

// ── Star Picker ────────────────────────────────────────────────────────────────
function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-transform hover:scale-110"
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              "w-8 h-8 transition-colors",
              star <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  );
}

// ── Star Display ───────────────────────────────────────────────────────────────
function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const cls = size === "md" ? "w-5 h-5" : "w-4 h-4";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(cls, s <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
        />
      ))}
    </div>
  );
}

// ── Review Form ────────────────────────────────────────────────────────────────
function ReviewForm({
  productId,
  existingReview,
  onSubmitted,
}: {
  productId: string;
  existingReview: { id: string; rating: number; comment: string | null; images: string[] } | null;
  onSubmitted: (review: Review) => void;
}) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [images, setImages] = useState<string[]>(existingReview?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: File[], currentCount: number) => {
    const allowed = 4 - currentCount;
    const toUpload = files.slice(0, allowed);
    if (toUpload.length === 0) {
      toast.error("Maximum 4 images per review");
      return;
    }
    setUploading(true);
    const urls: string[] = [];
    for (const file of toUpload) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5 MB`); continue; }
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("folder", "reviews");
        const res = await fetch("/api/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
        const { publicUrl } = await res.json();
        urls.push(publicUrl);
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    if (urls.length) setImages((prev) => [...prev, ...urls]);
    setUploading(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { toast.error("Please select a star rating"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rating, comment: comment.trim() || undefined, images }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Failed to submit review"); return; }
      setSubmitted(true);
      onSubmitted(json.data);
      toast.success(existingReview ? "Review updated!" : "Review submitted!");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <p className="text-sm font-medium text-emerald-800">
          {existingReview ? "Your review has been updated." : "Thanks for your review!"}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-foreground text-base">
        {existingReview ? "Edit your review" : "Write a review"}
      </h3>

      {/* Star picker */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Your rating</p>
        <StarPicker value={rating} onChange={setRating} />
        {rating > 0 && (
          <p className="text-xs text-muted-foreground">
            {["", "Poor", "Fair", "Good", "Very good", "Excellent"][rating]}
          </p>
        )}
      </div>

      {/* Comment */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Your review <span className="normal-case font-normal">(optional)</span></p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Share your experience with this product..."
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
        <p className="text-right text-xs text-muted-foreground">{comment.length}/1000</p>
      </div>

      {/* Image upload */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Photos <span className="normal-case font-normal">(optional, up to 4)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {images.map((url, i) => (
            <div key={i} className="relative h-20 w-20 rounded-xl overflow-hidden border border-border">
              <Image src={url} alt="" fill className="object-cover" sizes="80px" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {images.length < 4 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              <span className="text-[10px]">{uploading ? "Uploading…" : "Add photo"}</span>
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            uploadFiles(Array.from(e.target.files ?? []), images.length);
            e.target.value = "";
          }}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || rating === 0}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all",
          submitting || rating === 0
            ? "cursor-not-allowed bg-muted text-muted-foreground"
            : "bg-primary text-white hover:bg-primary/90 shadow-sm"
        )}
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {existingReview ? "Update review" : "Submit review"}
      </button>
    </form>
  );
}

// ── Image lightbox ─────────────────────────────────────────────────────────────
function ImageLightbox({ images, startAt, onClose }: { images: string[]; startAt: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startAt);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [images.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div className="relative max-w-3xl w-full h-[75vh]" onClick={(e) => e.stopPropagation()}>
        <Image src={images[idx]} alt="" fill className="object-contain rounded-xl" sizes="(max-width: 768px) 100vw, 768px" />
        <button
          onClick={onClose}
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
        >
          <X className="h-4 w-4" />
        </button>
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <button onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 text-lg">‹</button>
            <span className="text-white text-xs">{idx + 1} / {images.length}</span>
            <button onClick={() => setIdx((i) => (i + 1) % images.length)} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 text-lg">›</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ProductReviews({ productId, reviews: initialReviews, reviewCount }: ProductReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [eligibility, setEligibility] = useState<{
    hasPurchased: boolean;
    existingReview: { id: string; rating: number; comment: string | null; images: string[] } | null;
    checked: boolean;
    loggedIn: boolean;
  }>({ hasPurchased: false, existingReview: null, checked: false, loggedIn: false });
  const [lightbox, setLightbox] = useState<{ images: string[]; startAt: number } | null>(null);

  useEffect(() => {
    fetch(`/api/reviews?productId=${productId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setEligibility({
          hasPurchased: data.hasPurchased ?? false,
          existingReview: data.existingReview ?? null,
          checked: true,
          loggedIn: data.loggedIn === true,
        });
      })
      .catch(() => setEligibility((e) => ({ ...e, checked: true })));
  }, [productId]);

  const handleReviewSubmitted = (newReview: Review) => {
    setReviews((prev) => {
      const exists = prev.findIndex((r) => r.user.name === newReview.user?.name);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = newReview;
        return next;
      }
      return [newReview, ...prev];
    });
    setEligibility((e) => ({ ...e, existingReview: { id: newReview.id, rating: newReview.rating, comment: newReview.comment, images: newReview.images } }));
  };

  const averageRating = reviews.length > 0
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : 0;

  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="pt-8 border-t border-border space-y-8">
      <h2 className="text-xl font-bold text-foreground">Customer Reviews</h2>

      {/* ── Rating summary ── */}
      {reviews.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-6 rounded-2xl border border-border bg-muted/30 p-5">
          {/* Overall score */}
          <div className="flex flex-col items-center justify-center gap-1 sm:min-w-[120px]">
            <span className="text-5xl font-black text-foreground">{averageRating.toFixed(1)}</span>
            <StarDisplay rating={Math.round(averageRating)} size="md" />
            <span className="text-xs text-muted-foreground mt-1">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</span>
          </div>
          {/* Breakdown bars */}
          <div className="flex-1 space-y-1.5">
            {ratingBreakdown.map(({ star, count }) => (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-right text-muted-foreground">{star}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
                <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : "0%" }}
                  />
                </div>
                <span className="w-4 text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Write a review section ── */}
      <div>
        {!eligibility.checked ? (
          <div className="h-16 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking eligibility…
          </div>
        ) : !eligibility.loggedIn ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
            <LogIn className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              <a href="/login" className="font-semibold text-primary hover:underline">Sign in</a> to leave a review.
            </p>
          </div>
        ) : !eligibility.hasPurchased ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
            <ShoppingBag className="h-5 w-5 text-muted-foreground shrink-0" />
            <p className="text-sm text-muted-foreground">
              Only customers who have purchased this product can leave a review.
            </p>
          </div>
        ) : (
          <ReviewForm
            productId={productId}
            existingReview={eligibility.existingReview}
            onSubmitted={handleReviewSubmitted}
          />
        )}
      </div>

      {/* ── Review list ── */}
      {reviews.length > 0 ? (
        <div className="space-y-5">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-2xl border border-border bg-card p-5">
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary text-sm shrink-0">
                  {review.user.image ? (
                    <Image src={review.user.image} alt="" width={36} height={36} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    review.user.name?.charAt(0).toUpperCase() ?? "A"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm text-foreground">{review.user.name ?? "Anonymous"}</p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(review.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <StarDisplay rating={review.rating} />
                </div>
              </div>

              {/* Comment */}
              {review.comment && (
                <p className="text-sm text-foreground leading-relaxed mb-3">{review.comment}</p>
              )}

              {/* Images */}
              {review.images && review.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {review.images.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setLightbox({ images: review.images, startAt: i })}
                      className="relative h-20 w-20 rounded-xl overflow-hidden border border-border hover:opacity-90 transition-opacity"
                    >
                      <Image src={url} alt="" fill className="object-cover" sizes="80px" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No reviews yet. {eligibility.hasPurchased ? "Be the first to share your experience!" : ""}
        </p>
      )}

      {/* Lightbox */}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          startAt={lightbox.startAt}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
