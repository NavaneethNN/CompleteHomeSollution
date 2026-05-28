import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import BlogPostEditor from "../blog-post-editor";

export const metadata: Metadata = {
  title: "New Blog Post — Admin",
  description: "Create a new blog post",
};

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/admin/login");
  }
  return session;
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

export default async function NewBlogPostPage() {
  await requireAdmin();
  
  const [categories, tags] = await Promise.all([
    getCategories(),
    getTags(),
  ]);

  return (
    <div className="space-y-6 p-4 sm:p-6 w-full max-w-none">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">New Blog Post</h1>
      </div>
      
      <BlogPostEditor 
        categories={categories}
        tags={tags}
        mode="create"
      />
    </div>
  );
}
