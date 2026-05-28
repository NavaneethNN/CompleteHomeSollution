"use client";

import { useState, useRef, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { 
  Save, 
  Eye, 
  Upload, 
  X, 
  Plus,
  Image as ImageIcon,
  Video,
  Link2,
  Bold,
  Italic,
  List,
  Quote,
  Code,
  Heading
} from "lucide-react";
import { toast } from "sonner";

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
  const contentRef = useRef<HTMLDivElement>(null);
  
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

  const handleImageUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      
      const data = await response.json();
      return data.url;
    } catch (error) {
      toast.error("Failed to upload image");
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

  const insertContent = (type: string, value?: string) => {
    const textarea = document.getElementById("content-textarea") as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    let insertion = "";
    
    switch (type) {
      case "bold":
        insertion = `<strong>${selectedText || "Bold text"}</strong>`;
        break;
      case "italic":
        insertion = `<em>${selectedText || "Italic text"}</em>`;
        break;
      case "heading":
        insertion = `<h2>${selectedText || "Heading"}</h2>`;
        break;
      case "list":
        insertion = `<ul>\n  <li>${selectedText || "List item"}</li>\n  <li>Another item</li>\n</ul>`;
        break;
      case "quote":
        insertion = `<blockquote>${selectedText || "Quote text"}</blockquote>`;
        break;
      case "code":
        insertion = `<code>${selectedText || "Code"}</code>`;
        break;
      case "image":
        insertion = `<img src="${value || "/placeholder.jpg"}" alt="Image" />`;
        break;
      case "video":
        insertion = `<iframe src="${value || "https://www.youtube.com/embed/VIDEO_ID"}" frameborder="0" allowfullscreen class="w-full aspect-video rounded-lg"></iframe>`;
        break;
      case "link":
        insertion = `<a href="${value || "#"}">${selectedText || "Link text"}</a>`;
        break;
    }
    
    const newContent = textarea.value.substring(0, start) + insertion + textarea.value.substring(end);
    setFormData(prev => ({ ...prev, content: newContent }));
    
    // Refocus and set cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + insertion.length, start + insertion.length);
    }, 0);
  };

  const handleSave = async (publish = false) => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      const status = publish ? "PUBLISHED" : formData.status;
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
        router.push(`/admin/blog/${savedPost.id}/edit`);
      } else {
        setFormData(prev => ({
          ...prev,
          status: savedPost.status,
          publishedAt: savedPost.publishedAt,
          slug: savedPost.slug,
        }));
        toast.success(`Post ${publish ? "published" : "updated"} successfully!`);
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
            {saving ? "Saving..." : "Save Draft"}
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
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertContent("bold")}
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertContent("italic")}
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertContent("heading")}
                >
                  <Heading className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertContent("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertContent("quote")}
                >
                  <Quote className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertContent("code")}
                >
                  <Code className="h-4 w-4" />
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = prompt("Enter image URL:");
                    if (url) insertContent("image", url);
                  }}
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = prompt("Enter YouTube URL or embed code:");
                    if (url) insertContent("video", url);
                  }}
                >
                  <Video className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = prompt("Enter link URL:");
                    if (url) insertContent("link", url);
                  }}
                >
                  <Link2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                id="content-textarea"
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Write your post content here... You can use HTML tags for formatting."
                rows={20}
                className="font-mono text-sm"
              />
              <p className="text-xs text-slate-500 mt-2">
                Supports HTML formatting. YouTube URLs will be automatically converted to embeds.
              </p>
            </CardContent>
          </Card>
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
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverImageUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {loading ? "Uploading..." : "Upload Image"}
                  </Button>
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
