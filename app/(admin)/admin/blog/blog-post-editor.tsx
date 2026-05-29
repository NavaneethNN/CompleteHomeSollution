"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Eye, Upload, X, Plus } from "lucide-react";
import { toast } from "sonner";

const BlogRichEditor = dynamic(
  () => import("@/components/admin/blog-rich-editor"),
  { ssr: false, loading: () => <div className="h-[500px] border border-slate-200 rounded-xl bg-slate-50 animate-pulse" /> }
);

interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

interface BlogTag {
  id: string;
  name: string;
  slug: string;
  color: string | null;
}

interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  coverImage: string | null;
  status: string;
  featured: boolean;
  isMemberOnly: boolean;
  publishedAt: string | null;
  authorId: string | null;
  categoryId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  readTime: number | null;
  socialLinks: any;
  tags: Array<{ tagId: string }>;
}

interface BlogPostEditorProps {
  categories: BlogCategory[];
  tags: BlogTag[];
  mode: "create" | "edit";
  initialData?: Partial<BlogPostData>;
}

export default function BlogPostEditor({ categories, tags, mode, initialData }: BlogPostEditorProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialData?.tags?.map(t => t.tagId) || []
  );
  
  const [formData, setFormData] = useState<BlogPostData>({
    id: initialData?.id || "",
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    excerpt: initialData?.excerpt || "",
    content: initialData?.content || "",
    coverImage: initialData?.coverImage || "",
    status: initialData?.status || "DRAFT",
    featured: initialData?.featured || false,
    isMemberOnly: initialData?.isMemberOnly || false,
    publishedAt: initialData?.publishedAt || null,
    authorId: initialData?.authorId || null,
    categoryId: initialData?.categoryId || null,
    seoTitle: initialData?.seoTitle || null,
    seoDescription: initialData?.seoDescription || null,
    readTime: initialData?.readTime || null,
    socialLinks: initialData?.socialLinks || null,
    tags: initialData?.tags || [],
  });

  // Auto-generate slug from title — only in create mode
  useEffect(() => {
    if (mode === "create") {
      const slug = formData.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setFormData(prev => ({ ...prev, slug }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.title, mode]);

  const handleImageUpload = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "blog");

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      
      const data = await response.json();
      return data.publicUrl ?? data.url ?? null;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
      return null;
    }
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const url = await handleImageUpload(file);
      if (url) {
        setFormData(prev => ({ ...prev, coverImage: url }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (publish = false) => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      const status = publish ? "PUBLISHED" : "DRAFT";
      const payload = {
        ...formData,
        status,
        publishedAt: publish && !formData.publishedAt ? new Date().toISOString() : formData.publishedAt,
        tags: selectedTags.map(tagId => ({ tagId })),
      };

      const url = mode === "create"
        ? "/api/admin/blog"
        : `/api/admin/blog/${formData.id}`;

      const method = mode === "create" ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save post");
      }

      const savedPost = await response.json();

      if (mode === "create") {
        toast.success(`Post ${publish ? "published" : "saved"} successfully!`);
        if (publish) {
          router.push("/admin/blog");
        } else {
          router.push(`/admin/blog/${savedPost.id}/edit`);
        }
      } else {
        setFormData(prev => ({
          ...prev,
          status: savedPost.status,
          publishedAt: savedPost.publishedAt,
          slug: savedPost.slug,
        }));
        toast.success(`Post ${publish ? "published" : "updated"} successfully!`);
        // Redirect to blog listing after publishing from edit mode
        if (publish && savedPost.status === "PUBLISHED") {
          router.push("/admin/blog");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save post");
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving}
            size="sm"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : formData.status === "PUBLISHED" ? "Save as Draft" : "Save Draft"}
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={saving}
            size="sm"
          >
            <Eye className="h-4 w-4 mr-2" />
            {saving ? "Publishing..." : "Publish"}
          </Button>
        </div>

        {mode === "edit" && formData.slug && (
          <Button variant="outline" size="sm" asChild>
            <a href={`/blog/${formData.slug}`} target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </a>
          </Button>
        )}
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6 min-w-0">
          {/* Title */}
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter post title..."
              className="text-lg"
            />
          </div>

          {/* Slug */}
          <div>
            <Label htmlFor="slug">URL Slug</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="url-slug"
            />
          </div>

          {/* Excerpt */}
          <div>
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              value={formData.excerpt || ""}
              onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
              placeholder="Brief description of the post..."
              rows={3}
            />
          </div>

          {/* Content Editor */}
          <div>
            <Label className="mb-2 block">Content</Label>
            <BlogRichEditor
              value={formData.content}
              onChange={(html) => setFormData(prev => ({ ...prev, content: html }))}
              onImageUpload={handleImageUpload}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Cover Image */}
          <Card>
            <CardHeader>
              <CardTitle>Cover Image</CardTitle>
            </CardHeader>
            <CardContent>
              {formData.coverImage ? (
                <div className="space-y-3">
                  <img
                    src={formData.coverImage}
                    alt="Cover"
                    className="w-full h-40 object-cover rounded-lg"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, coverImage: null }))}
                    className="w-full"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverImageUpload}
                    className="hidden"
                  />
                  {/* Drag & drop / click zone */}
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (!file || !file.type.startsWith("image/")) return;
                      setLoading(true);
                      try {
                        const url = await handleImageUpload(file);
                        if (url) setFormData(prev => ({ ...prev, coverImage: url }));
                      } finally { setLoading(false); }
                    }}
                  >
                    <Upload className="h-6 w-6 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm text-slate-500">{loading ? "Uploading…" : "Click or drag & drop an image"}</p>
                    <p className="text-xs text-slate-400 mt-1">JPG, PNG, WebP up to 5MB</p>
                  </div>
                  {/* Paste URL */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Or paste image URL…"
                      onPaste={(e) => {
                        const text = e.clipboardData.getData("text");
                        if (text.match(/\.(jpg|jpeg|png|webp|gif|avif)(\?.*)?$/i) || text.startsWith("https://")) {
                          e.preventDefault();
                          setFormData(prev => ({ ...prev, coverImage: text }));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) setFormData(prev => ({ ...prev, coverImage: val }));
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.categoryId || "none"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, categoryId: value === "none" ? null : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="featured">Featured Post</Label>
                  <Switch
                    id="featured"
                    checked={formData.featured}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, featured: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="memberOnly">Member Only</Label>
                  <Switch
                    id="memberOnly"
                    checked={formData.isMemberOnly}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isMemberOnly: checked }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map((tagId) => {
                      const tag = tags.find(t => t.id === tagId);
                      return tag ? (
                        <Badge
                          key={tagId}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => toggleTag(tagId)}
                        >
                          {tag.name}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
                
                <div className="space-y-2">
                  {tags
                    .filter(tag => !selectedTags.includes(tag.id))
                    .map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                        onClick={() => toggleTag(tag.id)}
                      >
                        <span className="text-sm">{tag.name}</span>
                        <Plus className="h-4 w-4 text-slate-400" />
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader>
              <CardTitle>SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="seoTitle">SEO Title</Label>
                <Input
                  id="seoTitle"
                  value={formData.seoTitle || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, seoTitle: e.target.value }))}
                  placeholder="Custom SEO title (optional)"
                />
              </div>
              
              <div>
                <Label htmlFor="seoDescription">SEO Description</Label>
                <Textarea
                  id="seoDescription"
                  value={formData.seoDescription || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, seoDescription: e.target.value }))}
                  placeholder="Custom SEO description (optional)"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
