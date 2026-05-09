"use client";

import { Star } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  user: {
    name: string | null;
    image: string | null;
  };
}

interface ProductReviewsProps {
  reviews: Review[];
  reviewCount: number;
}

export function ProductReviews({ reviews, reviewCount }: ProductReviewsProps) {
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
      : 0;

  return (
    <div className="mt-12 pt-8 border-t border-border">
      <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>

      {/* Rating Summary */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-6 h-6 ${
                star <= Math.round(averageRating)
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground"
              }`}
            />
          ))}
        </div>
        <span className="text-lg font-semibold">{averageRating.toFixed(1)}</span>
        <span className="text-muted-foreground">({reviewCount} reviews)</span>
      </div>

      {/* Review List */}
      {reviews.length > 0 ? (
        <div className="space-y-6">
          {reviews.map((review) => (
            <div key={review.id} className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                  {review.user.name?.charAt(0) || "A"}
                </div>
                <div>
                  <p className="font-medium">{review.user.name || "Anonymous"}</p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= review.rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="ml-auto text-sm text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              </div>
              {review.comment && <p className="text-foreground">{review.comment}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No reviews yet. Be the first to review this product!</p>
      )}
    </div>
  );
}
