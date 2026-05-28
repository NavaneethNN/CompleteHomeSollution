import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar, Clock, Eye, Lock, Search, User, ChevronRight, Crown } from "lucide-react";
import BlogPostCard from "@/components/blog/blog-post-card";
import BlogCategoryFilter from "@/components/blog/blog-category-filter";
import BecomeMemberCTA from "@/components/blog/become-member-cta";

export const metadata: Metadata = {
  title: "Blog - Complete Home Solution",
  description: "Discover the latest in home furniture, design trends, and expert tips from our team.",
};

// Helper function to calculate reading time
function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

async function getBlogPosts(search?: string, category?: string) {
  const where: any = {
    status: "PUBLISHED",
  };

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { excerpt: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
    ];
  }

  if (category && category !== "all") {
    where.category = { slug: category };
  }

  const posts = await db.blogPost.findMany({
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
  });

  // Calculate reading time for each post
  return posts.map(post => ({
    ...post,
    readTime: calculateReadingTime(post.content),
  }));
}

async function getCategories() {
  return await db.blogCategory.findMany({
    include: {
      _count: { select: { posts: { where: { status: "PUBLISHED" } } } },
    },
    orderBy: { name: "asc" },
  });
}

interface BlogPageProps {
  searchParams: Promise<{ search?: string; category?: string }>;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const session = await auth();
  const isMember = session?.user?.isMember ?? false;
  const { search, category } = await searchParams;

  const [posts, categories] = await Promise.all([
    getBlogPosts(search, category),
    getCategories(),
  ]);

  // Filter posts based on membership
  const publicPosts = posts.filter(post => !post.isMemberOnly);
  const memberPosts = posts.filter(post => post.isMemberOnly);

  // For non-members, show only 2 most interesting posts (featured or recent)
  const previewPosts = isMember 
    ? posts 
    : publicPosts
        .sort((a, b) => {
          // Prioritize featured posts
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          // Then by published date
          return new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime();
        })
        .slice(0, 2);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Our Blog
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Discover the latest in home furniture, design trends, and expert tips from our team.
            </p>
            {!isMember && (
              <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full">
                <Crown className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">
                  Become a member to unlock all articles
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Main Content */}
          <div className="flex-1">
            {/* Search Bar */}
            <div className="mb-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="search"
                  placeholder="Search articles..."
                  className="pl-10 h-12 text-base"
                  name="search"
                  defaultValue={search}
                />
              </div>
            </div>

            {/* Posts Grid */}
            {previewPosts.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {previewPosts.map((post) => (
                  <BlogPostCard 
                    key={post.id} 
                    post={post} 
                    isMember={isMember}
                    showLockIcon={!isMember && post.isMemberOnly}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-500">No articles found.</p>
              </div>
            )}

            {/* Become Member CTA for non-members */}
            {!isMember && publicPosts.length > 2 && (
              <BecomeMemberCTA totalPosts={publicPosts.length + memberPosts.length} />
            )}

            {/* Member-only content notice */}
            {!isMember && memberPosts.length > 0 && (
              <div className="mt-8 p-6 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <Lock className="h-5 w-5 text-amber-600" />
                  <h3 className="font-semibold text-amber-900">Member Exclusive Content</h3>
                </div>
                <p className="text-amber-700 mb-4">
                  There are {memberPosts.length} premium articles available exclusively for our members.
                </p>
                <Link href="/membership">
                  <Button className="bg-amber-600 hover:bg-amber-700">
                    <Crown className="h-4 w-4 mr-2" />
                    Become a Member
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="lg:w-80">
            {/* Categories */}
            <BlogCategoryFilter 
              categories={categories} 
              selectedCategory={category || "all"} 
            />

            {/* Recent Posts */}
            <Card className="mt-6">
              <CardHeader>
                <h3 className="font-semibold text-slate-900">Recent Articles</h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {posts.slice(0, 5).map((post) => (
                    <Link
                      key={post.id}
                      href={`/blog/${post.slug}`}
                      className="group block"
                    >
                      <div className="flex gap-3">
                        {post.coverImage && (
                          <img
                            src={post.coverImage}
                            alt={post.title}
                            className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-slate-900 group-hover:text-primary line-clamp-2">
                            {post.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <Calendar className="h-3 w-3" />
                            {new Date(post.publishedAt || post.createdAt).toLocaleDateString("en-AU", {
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
