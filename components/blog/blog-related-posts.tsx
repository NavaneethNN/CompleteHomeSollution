import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, Eye } from "lucide-react";

interface BlogRelatedPostsProps {
  posts: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    coverImage: string | null;
    publishedAt: Date | null;
    createdAt: Date;
    readTime: number | null;
    viewCount: number;
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
  }>;
}

export default function BlogRelatedPosts({ posts }: BlogRelatedPostsProps) {
  if (posts.length === 0) return null;

  return (
    <section className="border-t border-slate-200 pt-12">
      <h2 className="text-2xl font-bold text-slate-900 mb-8">Related Articles</h2>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => {
          const publishDate = post.publishedAt || post.createdAt;
          
          return (
            <article key={post.id} className="group">
              <Card className="overflow-hidden border-slate-200 hover:shadow-lg transition-all duration-300 hover:border-slate-300">
                {/* Cover Image */}
                {post.coverImage && (
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={post.coverImage}
                      alt={post.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                
                <CardContent className="p-5">
                  {/* Category */}
                  {post.category && (
                    <div className="mb-3">
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
                    </div>
                  )}

                  {/* Title */}
                  <h3 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    <Link href={`/blog/${post.slug}`}>
                      {post.title}
                    </Link>
                  </h3>

                  {/* Excerpt */}
                  {post.excerpt && (
                    <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}

                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-3">
                      {/* Date */}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {publishDate.toLocaleDateString("en-AU", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>

                      {/* Read Time */}
                      {post.readTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{post.readTime}m</span>
                        </div>
                      )}
                    </div>

                    {/* Views */}
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      <span>{post.viewCount}</span>
                    </div>
                  </div>

                  {/* Read More */}
                  <div className="mt-4">
                    <Link 
                      href={`/blog/${post.slug}`}
                      className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      Read More →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </article>
          );
        })}
      </div>
    </section>
  );
}
