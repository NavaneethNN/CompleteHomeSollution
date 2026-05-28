import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Calendar, 
  Clock, 
  Eye, 
  ChevronLeft,
  User,
  Globe,
  MessageCircle,
  Camera,
  Play,
  Lock,
  Crown
} from "lucide-react";
import BlogRelatedPosts from "@/components/blog/blog-related-posts";
import BlogSocialShare from "@/components/blog/blog-social-share";
import BlogLikeButton from "@/components/blog/blog-like-button";

// Helper function to calculate reading time
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

// Helper function to extract YouTube URLs and convert to embed
function processContent(content: string): string {
  // Convert YouTube URLs to embed format
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/g;
  return content.replace(youtubeRegex, (match, videoId) => {
    return `<div class="video-container">
      <iframe 
        src="https://www.youtube.com/embed/${videoId}" 
        frameborder="0" 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen
        class="w-full aspect-video rounded-lg"
      ></iframe>
    </div>`;
  });
}

async function getBlogPost(slug: string, userId?: string) {
  const post = await db.blogPost.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true, image: true, isMember: true } },
      category: { select: { id: true, name: true, slug: true, color: true } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true, color: true } } } },
      _count: { select: { likes: true } },
    },
  });

  if (!post) return null;

  // Increment view count
  await db.blogPost.update({
    where: { id: post.id },
    data: { viewCount: { increment: 1 } },
  });

  // Check if user liked this post
  let userLiked = false;
  if (userId) {
    const like = await db.blogLike.findUnique({
      where: {
        postId_userId: {
          postId: post.id,
          userId: userId,
        },
      },
    });
    userLiked = !!like;
  }

  // Calculate reading time
  const readTime = calculateReadingTime(post.content);
  
  // Process content for embedded media
  const processedContent = processContent(post.content);

  return {
    ...post,
    readTime,
    processedContent,
    likeCount: post._count.likes,
    userLiked,
  };
}

async function getRelatedPosts(postId: string, categoryId?: string, limit = 3) {
  const where: any = {
    id: { not: postId },
    status: "PUBLISHED",
  };

  if (categoryId) {
    where.categoryId = categoryId;
  }

  return await db.blogPost.findMany({
    where,
    include: {
      author: { select: { id: true, name: true, image: true } },
      category: { select: { id: true, name: true, slug: true, color: true } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true, color: true } } } },
    },
    orderBy: [
      { featured: "desc" },
      { publishedAt: "desc" },
    ],
    take: limit,
  });
}

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await db.blogPost.findUnique({
    where: { slug },
    select: {
      title: true,
      excerpt: true,
      coverImage: true,
      seoTitle: true,
      seoDescription: true,
    },
  });

  if (!post) return { title: "Post Not Found" };

  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt || undefined,
    openGraph: {
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt || undefined,
      images: post.coverImage ? [post.coverImage] : [],
      type: "article",
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const session = await auth();
  const isMember = session?.user?.isMember ?? false;
  const { slug } = await params;

  const post = await getBlogPost(slug, session?.user?.id);
  if (!post) notFound();

  // Check if user can access this post
  if (post.isMemberOnly && !isMember) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100 rounded-full mb-6">
              <Lock className="h-10 w-10 text-amber-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-4">
              This is a Member-Only Article
            </h1>
            <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
              Get instant access to this article and hundreds more by becoming a Complete Home Solution member.
            </p>
            
            <div className="bg-white rounded-xl border border-slate-200 p-8 max-w-md mx-auto mb-8">
              <h3 className="font-semibold text-slate-900 mb-2">What you'll get:</h3>
              <ul className="text-left text-sm text-slate-600 space-y-2">
                <li>• Access to all member-only articles</li>
                <li>• Exclusive design tips and trends</li>
                <li>• Early access to new collections</li>
                <li>• Member pricing on selected items</li>
              </ul>
            </div>
            
            <Link href="/membership">
              <Button size="lg" className="bg-amber-600 hover:bg-amber-700">
                <Crown className="h-5 w-5 mr-2" />
                Become a Member
              </Button>
            </Link>
            
            <p className="text-sm text-slate-500 mt-4">
              or <Link href="/blog" className="text-primary hover:underline">browse all articles</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const relatedPosts = await getRelatedPosts(post.id, post.categoryId ?? undefined);
  const publishDate = post.publishedAt || post.createdAt;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Back Navigation */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link 
            href="/blog" 
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Blog
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Article Header */}
        <article className="mb-12">
          {/* Category */}
          {post.category && (
            <div className="mb-4">
              <Link href={`/blog?category=${post.category.slug}`}>
                <Badge 
                  variant="outline" 
                  className="hover:bg-slate-50"
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
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6 leading-tight">
            {post.title}
          </h1>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              {post.excerpt}
            </p>
          )}

          {/* Article Meta */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-slate-500 mb-8">
            {/* Author */}
            {post.author && (
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={post.author.image || undefined} alt={post.author.name || undefined} />
                  <AvatarFallback>
                    {post.author.name?.charAt(0) || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-slate-900 text-sm">{post.author.name}</p>
                  {post.author.isMember && (
                    <div className="flex items-center gap-1 text-amber-600">
                      <Crown className="h-3 w-3" />
                      <span className="text-xs">Member</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="hidden sm:block w-px h-6 bg-slate-200" />

            {/* Date */}
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4 shrink-0" />
              <time dateTime={publishDate.toISOString()}>
                {publishDate.toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </time>
            </div>

            {/* Read Time */}
            {post.readTime && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 shrink-0" />
                <span>{post.readTime} min read</span>
              </div>
            )}

            {/* Views */}
            <div className="flex items-center gap-1">
              <Eye className="h-4 w-4 shrink-0" />
              <span>{post.viewCount} views</span>
            </div>
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {post.tags.map(({ tag }) => (
                <Link key={tag.id} href={`/blog?tag=${tag.slug}`}>
                  <Badge 
                    variant="secondary" 
                    className="text-xs hover:bg-slate-100"
                    style={{ 
                      backgroundColor: tag.color ? `${tag.color}20` : undefined,
                      color: tag.color || undefined 
                    }}
                  >
                    #{tag.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Cover Image */}
          {post.coverImage && (
            <div className="mb-8">
              <img
                src={post.coverImage}
                alt={post.title}
                className="w-full h-auto rounded-xl border border-slate-200"
              />
            </div>
          )}

          {/* Social Share */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
            <BlogSocialShare 
              title={post.title}
              url={`${process.env.NEXT_PUBLIC_APP_URL}/blog/${post.slug}`}
            />
            <div className="flex items-center gap-2">
              <BlogLikeButton 
                postSlug={post.slug}
                initialLikeCount={post.likeCount}
                initialUserLiked={post.userLiked}
              />
            </div>
          </div>

          <Separator className="mb-8" />

          {/* Article Content */}
          <div 
            className="prose prose-lg max-w-none prose-slate prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-slate-900 prose-code:text-slate-900 prose-pre:bg-slate-50 prose-blockquote:border-l-amber-500 prose-blockquote:bg-amber-50 prose-blockquote:text-slate-700"
            dangerouslySetInnerHTML={{ __html: post.processedContent }}
          />

          {/* Social Links (if any) */}
          {post.socialLinks && (
            <Card className="mt-12">
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-900 mb-4">Follow & Connect</h3>
                <div className="flex gap-3">
                  {/* Parse social links from JSON and display icons */}
                  <Button variant="outline" size="sm">
                    <Globe className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Camera className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Play className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </article>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <BlogRelatedPosts posts={relatedPosts} />
        )}
      </div>
    </div>
  );
}
