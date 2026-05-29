import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Eye, Lock, User, ChevronRight, Heart } from "lucide-react";

interface BlogPostCardProps {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    coverImage: string | null;
    publishedAt: Date | null;
    createdAt: Date;
    readTime: number | null;
    viewCount: number;
    likeCount: number;
    author?: {
      id: string;
      name: string | null;
      image: string | null;
    } | null;
    category?: {
      id: string;
      name: string;
      slug: string;
      color: string | null;
    } | null;
    tags: Array<{
      tag: {
        id: string;
        name: string;
        slug: string;
        color: string | null;
      };
    }>;
    featured: boolean;
    isMemberOnly: boolean;
  };
  isMember: boolean;
  showLockIcon?: boolean;
}

export default function BlogPostCard({ post, isMember, showLockIcon }: BlogPostCardProps) {
  const publishDate = post.publishedAt || post.createdAt;
  const isLocked = post.isMemberOnly && !isMember;

  return (
    <article className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-slate-300">
      {/* Cover Image */}
      {post.coverImage && (
        <div className="relative h-48 overflow-hidden">
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {post.featured && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold">
                Featured
              </Badge>
            </div>
          )}
          {showLockIcon && (
            <div className="absolute top-3 right-3">
              <div className="flex items-center gap-1 px-2 py-1 bg-slate-900/80 backdrop-blur-sm rounded-full">
                <Lock className="h-3 w-3 text-white" />
                <span className="text-xs text-white font-medium">Member</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="p-6">
        {/* Category and Tags */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {post.category && (
            <Link href={`/blog?category=${post.category.slug}`}>
              <Badge 
                variant="outline" 
                className="text-xs font-medium hover:bg-slate-50"
                style={{ 
                  borderColor: post.category.color || undefined,
                  color: post.category.color || undefined 
                }}
              >
                {post.category.name}
              </Badge>
            </Link>
          )}
          {post.tags.slice(0, 2).map(({ tag }) => (
            <Link key={tag.id} href={`/blog?tag=${tag.slug}`}>
              <Badge 
                variant="secondary" 
                className="text-xs"
                style={{ 
                  backgroundColor: tag.color ? `${tag.color}20` : undefined,
                  color: tag.color || undefined 
                }}
              >
                {tag.name}
              </Badge>
            </Link>
          ))}
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          <Link href={isLocked ? "/membership" : `/blog/${post.slug}`}>
            {post.title}
          </Link>
        </h3>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-slate-600 text-sm mb-4 line-clamp-3">
            {post.excerpt}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            {/* Author */}
            {post.author?.name && (
              <div className="flex items-center gap-1">
                {post.author.image ? (
                  <Image
                    src={post.author.image}
                    alt={post.author.name}
                    width={16}
                    height={16}
                    className="rounded-full"
                  />
                ) : (
                  <User className="h-4 w-4" />
                )}
                <span>{post.author.name}</span>
              </div>
            )}
            
            {/* Date */}
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>
                {publishDate.toLocaleDateString("en-AU", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            {/* Read Time */}
            {post.readTime && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{post.readTime} min read</span>
              </div>
            )}
          </div>

          {/* Views */}
          <div className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            <span>{post.viewCount}</span>
          </div>

          {/* Likes */}
          <div className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            <span>{post.likeCount}</span>
          </div>
        </div>

        {/* Read More */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <Link 
            href={isLocked ? "/membership" : `/blog/${post.slug}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {isLocked ? "Unlock with Membership" : "Read More"}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
