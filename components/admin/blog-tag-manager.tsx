"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Plus, Tag, Hash, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface BlogTag {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  _count: { posts: number };
}

interface TagManagerProps {
  initialTags: BlogTag[];
}

const PRESET_COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#84cc16", // Lime
  "#10b981", // Emerald
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#1e293b", // Slate
];

export function TagManager({ initialTags }: TagManagerProps) {
  const [tags, setTags] = useState(initialTags);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Tag name is required");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/blog/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create tag");
      }

      const { tag } = await response.json();
      setTags([...tags, tag]);
      toast.success(`Tag "${name}" created successfully`);
      setIsOpen(false);
      setName("");
      setColor(PRESET_COLORS[0]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create tag");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-pink-500" />
          Tags
        </CardTitle>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Tag</DialogTitle>
              <DialogDescription>
                Add a new tag for labeling blog posts.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tagName">Name *</Label>
                <Input
                  id="tagName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Living Room"
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full transition-all ${
                        color === c ? "ring-2 ring-offset-2 ring-slate-900 scale-110" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreate} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Tag
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {tags.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            No tags yet. Create your first tag.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const tagColor = tag.color || "#6366f1";
              return (
                <div
                  key={tag.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border"
                  style={{
                    backgroundColor: `${tagColor}15`,
                    borderColor: `${tagColor}30`,
                    color: tagColor,
                  }}
                >
                  <span className="font-medium">{tag.name}</span>
                  <span className="text-xs opacity-75">({tag._count.posts})</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
