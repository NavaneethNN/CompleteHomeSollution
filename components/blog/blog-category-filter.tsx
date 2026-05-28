"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Folder } from "lucide-react";

interface BlogCategoryFilterProps {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    color: string | null;
    _count: { posts: number };
  }>;
  selectedCategory: string;
}

export default function BlogCategoryFilter({ categories, selectedCategory }: BlogCategoryFilterProps) {
  const searchParams = useSearchParams();
  
  const createUrl = (category: string) => {
    const params = new URLSearchParams(searchParams);
    if (category === "all") {
      params.delete("category");
    } else {
      params.set("category", category);
    }
    return `/blog?${params.toString()}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Folder className="h-5 w-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Categories</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Link href={createUrl("all")}>
            <div
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedCategory === "all"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-slate-50 text-slate-700"
              }`}
            >
              <span>All Posts</span>
              <Badge variant={selectedCategory === "all" ? "secondary" : "outline"} className="text-xs">
                {categories.reduce((sum, cat) => sum + cat._count.posts, 0)}
              </Badge>
            </div>
          </Link>
          
          {categories.map((category) => (
            <Link key={category.id} href={createUrl(category.slug)}>
              <div
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCategory === category.slug
                    ? "bg-primary text-primary-foreground font-medium"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  {category.color && (
                    <div
                      className="w-3 h-3 rounded-full border border-slate-300"
                      style={{ backgroundColor: category.color }}
                    />
                  )}
                  <span>{category.name}</span>
                </div>
                <Badge variant={selectedCategory === category.slug ? "secondary" : "outline"} className="text-xs">
                  {category._count.posts}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
