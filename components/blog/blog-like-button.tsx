"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { toast } from "sonner";

interface BlogLikeButtonProps {
  postSlug: string;
  initialLikeCount: number;
  initialUserLiked?: boolean;
}

export default function BlogLikeButton({ 
  postSlug, 
  initialLikeCount, 
  initialUserLiked = false 
}: BlogLikeButtonProps) {
  const { data: session } = useSession();
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLiked, setIsLiked] = useState(initialUserLiked);
  const [isLoading, setIsLoading] = useState(false);

  // Update state when initial props change
  useEffect(() => {
    setLikeCount(initialLikeCount);
    setIsLiked(initialUserLiked);
  }, [initialLikeCount, initialUserLiked]);

  const handleLike = async () => {
    if (!session) {
      toast.error("Please sign in to like posts");
      return;
    }

    if (!session.user.isMember) {
      toast.error("Membership required to like posts");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/blog/${postSlug}/like`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update like");
      }

      const data = await response.json();
      setLikeCount(data.likeCount);
      setIsLiked(data.liked);
      
      if (data.liked) {
        toast.success("Post liked!");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update like");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={isLiked ? "default" : "outline"}
      size="sm"
      onClick={handleLike}
      disabled={isLoading}
      className={`gap-2 transition-colors ${
        isLiked 
          ? "bg-red-500 hover:bg-red-600 text-white" 
          : "hover:bg-red-50 hover:text-red-600 hover:border-red-300"
      }`}
    >
      <Heart 
        className={`h-4 w-4 ${isLiked ? "fill-current" : ""}`} 
      />
      <span>{likeCount}</span>
    </Button>
  );
}
