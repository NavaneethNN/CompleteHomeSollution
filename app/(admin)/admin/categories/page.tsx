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
  Tag,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ImageUploader } from "@/components/admin/image-uploader";
import type { Category } from "@prisma/client";

interface CategoryWithCount extends Category {
  _count: {
    products: number;
  };
}

function resetFormState(
  setName: (v: string) => void,
  setImages: (v: string[]) => void
) {
  setName("");
  setImages([]);
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithCount | null>(null);

  const [formName, setFormName] = useState("");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formLoading, setFormLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/categories");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCategories(data.categories);
    } catch {
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

  const handleCreateClose = (open: boolean) => {
    if (!open) {
      resetFormState(setFormName, setFormImages);
    }
    setIsCreateOpen(open);
  };

  const handleEditClose = (open: boolean) => {
    if (!open) {
      resetFormState(setFormName, setFormImages);
      setSelectedCategory(null);
    }
    setIsEditOpen(open);
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error("Category name is required");
      return;
    }
    setFormLoading(true);
    try {
      const imageUrl = formImages[0] ?? null;
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim(), image: imageUrl }),
      });
      if (!res.ok) throw new Error("Failed to create");
      toast.success(`Category "${formName.trim()}" created`);
      handleCreateClose(false);
      fetchCategories();
    } catch {
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
      const imageUrl = formImages[0] ?? null;
      const res = await fetch(`/api/admin/categories/${selectedCategory.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim(), image: imageUrl }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Category updated");
      handleEditClose(false);
      fetchCategories();
    } catch {
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
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast.success(`"${selectedCategory.name}" deleted`);
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
    setFormImages(category.image ? [category.image] : []);
    setIsEditOpen(true);
  };

  const openDelete = (category: CategoryWithCount) => {
    setSelectedCategory(category);
    setIsDeleteOpen(true);
  };

  const totalProducts = categories.reduce((sum, c) => sum + c._count.products, 0);
  const emptyCategories = categories.filter((c) => c._count.products === 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Organize your products into categories
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Categories", value: categories.length, icon: FolderTree, color: "text-slate-600", bg: "bg-slate-50" },
          { label: "Total Products", value: totalProducts, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Empty Categories", value: emptyCategories, icon: Tag, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500">{stat.label}</p>
                <p className="text-xl font-bold text-slate-900">{loading ? "—" : stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search categories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-10"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Categories Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-pulse">
              <Skeleton className="h-36 w-full rounded-none" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2 pt-1">
                  <Skeleton className="h-8 w-full rounded-lg" />
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              </div>
            </div>
          ))
        ) : filteredCategories.length === 0 ? (
          <div className="col-span-full py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <FolderTree className="h-8 w-8 text-slate-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">No categories found</p>
                <p className="text-sm text-slate-400 mt-0.5">
                  {search ? "Try adjusting your search" : "Create your first category to get started"}
                </p>
              </div>
              {!search && (
                <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Category
                </Button>
              )}
            </div>
          </div>
        ) : (
          filteredCategories.map((category) => (
            <div
              key={category.id}
              className="group rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md hover:border-slate-300 transition-all"
            >
              {/* Image — clickable to edit */}
              <button
                type="button"
                onClick={() => openEdit(category)}
                className="relative block h-36 w-full bg-slate-100 cursor-pointer focus:outline-none"
                title={`Edit ${category.name}`}
              >
                {category.image ? (
                  <img
                    src={category.image}
                    alt={category.name}
                    className="h-full w-full object-cover group-hover:brightness-90 transition-[filter]"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <div className={`flex h-full w-full items-center justify-center group-hover:bg-slate-200 transition-colors ${category.image ? "hidden" : ""}`}>
                  <ImageIcon className="h-10 w-10 text-slate-300" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <span className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow">
                    <Pencil className="mr-1.5 inline h-3 w-3" />
                    Edit
                  </span>
                </div>
              </button>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() => openEdit(category)}
                    className="font-semibold text-slate-900 leading-tight hover:text-primary transition-colors text-left"
                  >
                    {category.name}
                  </button>
                  <Badge
                    className={`shrink-0 text-xs border-0 ${
                      category._count.products === 0
                        ? "bg-slate-100 text-slate-500"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {category._count.products}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mb-3 font-mono">/{category.slug}</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => openEdit(category)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                    onClick={() => openDelete(category)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={handleCreateClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
            <DialogDescription>
              Add a new category to organize your products
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-name">Category Name <span className="text-red-500">*</span></Label>
              <Input
                id="create-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Living Room"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category Image <span className="text-slate-400 font-normal">(optional)</span></Label>
              <ImageUploader
                images={formImages}
                onChange={setFormImages}
                maxImages={1}
                folder="categories"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleCreateClose(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={formLoading || !formName.trim()}>
              {formLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
              ) : (
                <><Check className="mr-2 h-4 w-4" />Create Category</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={handleEditClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update the name and image for <span className="font-medium text-slate-700">{selectedCategory?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Category Name <span className="text-red-500">*</span></Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Living Room"
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category Image <span className="text-slate-400 font-normal">(optional)</span></Label>
              <ImageUploader
                images={formImages}
                onChange={setFormImages}
                maxImages={1}
                folder="categories"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleEditClose(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={formLoading || !formName.trim()}>
              {formLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              ) : (
                <><Check className="mr-2 h-4 w-4" />Save Changes</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              Delete Category
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-slate-800">"{selectedCategory?.name}"</span>?
                </p>
                {(selectedCategory?._count.products ?? 0) > 0 ? (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <p className="text-sm text-red-700">
                      This category contains{" "}
                      <strong>{selectedCategory?._count.products} product{selectedCategory?._count.products !== 1 ? "s" : ""}</strong>.
                      {" "}Move or delete these products before deleting this category.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                    <p className="text-sm text-red-700">
                      This action cannot be undone.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={formLoading}
              onClick={() => setSelectedCategory(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={formLoading || (selectedCategory?._count.products ?? 0) > 0}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {formLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>
              ) : (
                <><Trash2 className="mr-2 h-4 w-4" />Delete Category</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
