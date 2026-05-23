"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderTree,
  Plus,
  Search,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Package,
  X,
  Check,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { Category } from "@prisma/client";

interface CategoryWithCount extends Category {
  _count: {
    products: number;
  };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithCount | null>(null);
  
  // Form states
  const [formName, setFormName] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCategories(data.categories);
    } catch (error) {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setFormImageFile(null);
    setFormImagePreview(null);
    setFormImage("");
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error("Category name is required");
      return;
    }

    setFormLoading(true);
    try {
      // Use preview (base64) as image URL for demo, or upload to storage in production
      const imageUrl = formImagePreview || formImage || null;

      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          image: imageUrl,
        }),
      });

      if (!res.ok) throw new Error("Failed to create");

      toast.success("Category created successfully");
      setIsCreateOpen(false);
      setFormName("");
      setFormImage("");
      setFormImageFile(null);
      setFormImagePreview(null);
      fetchCategories();
    } catch (error) {
      toast.error("Failed to create category");
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedCategory || !formName.trim()) {
      toast.error("Category name is required");
      return;
    }

    setFormLoading(true);
    try {
      // Use preview (base64) if available, otherwise use existing image
      const imageUrl = formImagePreview || formImage || null;

      const res = await fetch(`/api/admin/categories/${selectedCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          image: imageUrl,
        }),
      });

      if (!res.ok) throw new Error("Failed to update");

      toast.success("Category updated successfully");
      setIsEditOpen(false);
      setSelectedCategory(null);
      setFormName("");
      setFormImage("");
      setFormImageFile(null);
      setFormImagePreview(null);
      fetchCategories();
    } catch (error) {
      toast.error("Failed to update category");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;

    setFormLoading(true);
    try {
      const res = await fetch(`/api/admin/categories/${selectedCategory.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete");
      }

      toast.success("Category deleted successfully");
      setIsDeleteOpen(false);
      setSelectedCategory(null);
      fetchCategories();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete category");
    } finally {
      setFormLoading(false);
    }
  };

  const openEdit = (category: CategoryWithCount) => {
    setSelectedCategory(category);
    setFormName(category.name);
    setFormImage(category.image || "");
    setFormImagePreview(category.image || null);
    setFormImageFile(null);
    setIsEditOpen(true);
  };

  const openDelete = (category: CategoryWithCount) => {
    setSelectedCategory(category);
    setIsDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500">
            Manage product categories and organization
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-primary">
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Categories Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading ? (
          // Loading skeletons
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-32 w-full" />
              <CardContent className="p-4">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))
        ) : filteredCategories.length === 0 ? (
          <div className="col-span-full py-12 text-center">
            <FolderTree className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-2 font-medium text-slate-600">No categories found</p>
            <p className="text-sm text-slate-500">
              {search ? "Try adjusting your search" : "Create your first category to get started"}
            </p>
          </div>
        ) : (
          filteredCategories.map((category) => (
            <Card key={category.id} className="overflow-hidden group">
              {/* Category Image */}
              <div className="relative h-32 bg-slate-100">
                {category.image ? (
                  <img
                    src={category.image}
                    alt={category.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-10 w-10 text-slate-300" />
                  </div>
                )}
                {/* Hover Actions */}
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEdit(category)}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openDelete(category)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </div>

              <CardContent className="p-4">
                <h3 className="font-semibold text-slate-900">{category.name}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    <Package className="mr-1 h-3 w-3" />
                    {category._count.products} products
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">/{category.slug}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
            <DialogDescription>
              Add a new category to organize your products
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Category Name</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Living Room"
              />
            </div>
            <div className="space-y-2">
              <Label>Category Image (optional)</Label>
              <div className="flex flex-col gap-3">
                {/* Preview */}
                {formImagePreview ? (
                  <div className="relative h-32 w-full rounded-lg border overflow-hidden">
                    <img
                      src={formImagePreview}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                    <button
                      onClick={clearImage}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 hover:border-primary hover:bg-slate-50 transition-colors">
                    <Upload className="h-8 w-8 text-slate-400" />
                    <span className="mt-2 text-sm text-slate-500">Click to upload image</span>
                    <span className="text-xs text-slate-400">JPG, PNG, GIF (optional)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={formLoading}>
              {formLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Create
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update category name and image
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Category Name</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Living Room"
              />
            </div>
            <div className="space-y-2">
              <Label>Category Image (optional)</Label>
              <div className="flex flex-col gap-3">
                {/* Preview */}
                {formImagePreview ? (
                  <div className="relative h-32 w-full rounded-lg border overflow-hidden">
                    <img
                      src={formImagePreview}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                    <button
                      onClick={clearImage}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 hover:border-primary hover:bg-slate-50 transition-colors">
                    <Upload className="h-8 w-8 text-slate-400" />
                    <span className="mt-2 text-sm text-slate-500">Click to upload image</span>
                    <span className="text-xs text-slate-400">JPG, PNG, GIF (optional)</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={formLoading}>
              {formLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{selectedCategory?.name}</strong>?
              <br /><br />
              {selectedCategory?._count.products ? (
                <span className="text-red-600">
                  This category has {selectedCategory._count.products} products.
                  You must move or delete these products first.
                </span>
              ) : (
                "This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedCategory(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={formLoading || (selectedCategory?._count.products ?? 0) > 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {formLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
