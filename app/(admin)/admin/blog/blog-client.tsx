"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Edit, 
  Eye, 
  MoreHorizontal, 
  Search, 
  Trash2,
  Calendar,
  Clock,
  ViewIcon,
  Crown
} from "lucide-react";
import { toast } from "sonner";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  status: string;
  featured: boolean;
  isMemberOnly: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  viewCount: number;
  readTime: number | null;
  coverImage: string | null;
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
  _count: { tags: number };
}

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  _count: { posts: number };
}

interface BlogTag {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  _count: { posts: number };
}

interface BlogClientProps {
  initialPosts: BlogPost[];
  categories: BlogCategory[];
  tags: BlogTag[];
}

export default function BlogClient({ initialPosts, categories, tags }: BlogClientProps) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  // Filter posts
  const filteredPosts = posts.filter(post => {
    const matchesSearch = !search || 
      post.title.toLowerCase().includes(search.toLowerCase()) ||
      post.slug.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || post.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || post.category?.slug === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post? This action cannot be undone.")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/blog/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete post");
      }

      setPosts(posts.filter(p => p.id !== postId));
      toast.success("Post deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete post");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      PUBLISHED: { variant: "default", label: "Published" },
      DRAFT: { variant: "secondary", label: "Draft" },
      ARCHIVED: { variant: "outline", label: "Archived" },
    };

    const config = variants[status] || variants.DRAFT;
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.slug}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Posts Table */}
      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Post</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Stats</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                  No posts found
                </TableCell>
              </TableRow>
            ) : (
              filteredPosts.map((post) => (
                <TableRow key={post.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {post.coverImage && (
                        <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                          <Image
                            src={post.coverImage}
                            alt={post.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-slate-900 truncate max-w-[200px]">
                            {post.title}
                          </h3>
                          {post.featured && (
                            <Badge variant="secondary" className="text-xs">
                              Featured
                            </Badge>
                          )}
                          {post.isMemberOnly && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                              <Crown className="h-3 w-3 mr-1" />
                              Member
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">
                          {post._count.tags} tags • {post.readTime || 0} min read
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {post.author?.image ? (
                        <Image
                          src={post.author.image}
                          alt={post.author.name || ""}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-slate-200 rounded-full" />
                      )}
                      <span className="text-sm text-slate-700">
                        {post.author?.name || "Unknown"}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {post.category ? (
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{
                          borderColor: post.category.color || undefined,
                          color: post.category.color || undefined,
                        }}
                      >
                        {post.category.name}
                      </Badge>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    {getStatusBadge(post.status)}
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <div className="flex items-center gap-1">
                        <ViewIcon className="h-3 w-3" />
                        {post.viewCount}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm text-slate-600">
                      {post.publishedAt ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(post.publishedAt).toLocaleDateString("en-AU", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/blog/${post.slug}`} target="_blank">
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/blog/${post.id}/edit`}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeletePost(post.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
