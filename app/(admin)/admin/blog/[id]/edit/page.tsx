import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import BlogPostEditor from "../../blog-post-editor";

export const metadata: Metadata = {
  title: "Edit Blog Post — Admin",
  description: "Edit blog post",
};

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/admin/login");
  }
  return session;
}

async function getBlogPost(id: string) {
  const post = await db.blogPost.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
    },
  });

  if (!post) notFound();
  return post;
}

async function getCategories() {
  return await db.blogCategory.findMany({
    orderBy: { name: "asc" },
  });
}

async function getTags() {
  return await db.blogTag.findMany({
    orderBy: { name: "asc" },
  });
}

interface EditBlogPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBlogPostPage({ params }: EditBlogPostPageProps) {
  await requireAdmin();
  const { id } = await params;
  
  const [post, categories, tags] = await Promise.all([
    getBlogPost(id),
    getCategories(),
    getTags(),
  ]);

  return (
    <div className="space-y-6 p-4 sm:p-6 w-full max-w-none">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Edit Blog Post</h1>
      </div>
      
      <BlogPostEditor 
        categories={categories}
        tags={tags}
        mode="edit"
        initialData={post ? { ...post, publishedAt: post.publishedAt instanceof Date ? post.publishedAt.toISOString() : post.publishedAt } : undefined}
      />
    </div>
  );
}
