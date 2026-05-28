import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Eye, Calendar } from "lucide-react";
import Link from "next/link";
import BlogClient from "./blog-client";
import { CategoryManager } from "@/components/admin/blog-category-manager";
import { TagManager } from "@/components/admin/blog-tag-manager";

export const metadata: Metadata = {
  title: "Blog Management — Admin",
  description: "Manage blog posts, categories, and tags",
};

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/admin/login");
  }
  return session;
}

async function getBlogPosts() {
  return await db.blogPost.findMany({
    include: {
      author: { select: { id: true, name: true, image: true } },
      category: { select: { id: true, name: true, slug: true, color: true } },
      tags: { include: { tag: { select: { id: true, name: true, slug: true, color: true } } } },
      _count: { select: { tags: true } },
    },
    orderBy: [
      { featured: "desc" },
      { createdAt: "desc" },
    ],
  });
}

async function getCategories() {
  return await db.blogCategory.findMany({
    include: {
      _count: { select: { posts: true } },
    },
    orderBy: { name: "asc" },
  });
}

async function getTags() {
  return await db.blogTag.findMany({
    include: {
      _count: { select: { posts: true } },
    },
    orderBy: { name: "asc" },
  });
}

export default async function AdminBlogPage() {
  await requireAdmin();
  
  const [posts, categories, tags] = await Promise.all([
    getBlogPosts(),
    getCategories(),
    getTags(),
  ]);

  const stats = {
    totalPosts: posts.length,
    publishedPosts: posts.filter(p => p.status === "PUBLISHED").length,
    draftPosts: posts.filter(p => p.status === "DRAFT").length,
    totalCategories: categories.length,
    totalTags: tags.length,
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 w-full max-w-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Blog Management</h1>
          <p className="text-slate-500">Manage blog posts, categories, and tags</p>
        </div>
        <Link href="/admin/blog/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Post
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Edit className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Total Posts</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalPosts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Eye className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Published</p>
                <p className="text-2xl font-bold text-slate-900">{stats.publishedPosts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Edit className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Drafts</p>
                <p className="text-2xl font-bold text-slate-900">{stats.draftPosts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Categories</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalCategories}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                <div className="w-2 h-2 bg-pink-600 rounded-full" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Tags</p>
                <p className="text-2xl font-bold text-slate-900">{stats.totalTags}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blog Posts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Blog Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <BlogClient 
            initialPosts={posts} 
            categories={categories}
            tags={tags}
          />
        </CardContent>
      </Card>

      {/* Categories & Tags Management */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryManager initialCategories={categories} />
        <TagManager initialTags={tags} />
      </div>
    </div>
  );
}
