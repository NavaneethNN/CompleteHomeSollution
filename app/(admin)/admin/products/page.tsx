"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Package,
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Layers,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { Product, Category } from "@prisma/client";

interface ProductWithRelations extends Product {
  category: { name: string; slug: string };
  productVariants: { stock: number }[];
  _count: {
    productVariants: number;
  };
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
});

export default function AdminProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [products, setProducts] = useState<ProductWithRelations[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get("search") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 20 });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (category && category !== "all") params.set("category", category);
      if (status && status !== "all") params.set("status", status);
      params.set("page", page.toString());

      const res = await fetch(`/api/admin/products?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setProducts(data.products);
      setPagination(data.pagination);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category, status, page]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCategories(data.categories);
    } catch {
      toast.error("Failed to load categories");
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    setPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setCategory("all");
    setStatus("all");
    setPage(1);
  };

  const hasActiveFilters = search || category !== "all" || status !== "all";

  const handleDelete = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${productToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(`"${productToDelete.name}" deleted`);
      fetchProducts();
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    }
  };

  const getTotalStock = (product: ProductWithRelations) => {
    if (product.hasVariants && product.productVariants?.length > 0) {
      return product.productVariants.reduce((sum, v) => sum + v.stock, 0);
    }
    return product.stock;
  };

  const stats = {
    total: pagination.total,
    active: products.filter((p) => p.isActive).length,
    outOfStock: products.filter((p) => getTotalStock(p) === 0 && p.isActive).length,
    withVariants: products.filter((p) => p.hasVariants).length,
  };

  const getStockDisplay = (stock: number) => {
    if (stock === 0)
      return <span className="font-semibold text-red-600">0</span>;
    if (stock < 5)
      return <span className="font-semibold text-amber-600">{stock}</span>;
    return <span className="text-slate-700">{stock.toLocaleString()}</span>;
  };

  const getStatusBadge = (isActive: boolean, stock: number) => {
    if (!isActive)
      return (
        <Badge className="bg-slate-100 text-slate-600 border-0 hover:bg-slate-100">
          <XCircle className="mr-1 h-3 w-3" />
          Inactive
        </Badge>
      );
    if (stock === 0)
      return (
        <Badge className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-50">
          <AlertTriangle className="mr-1 h-3 w-3" />
          Out of Stock
        </Badge>
      );
    if (stock < 5)
      return (
        <Badge className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50">
          <AlertTriangle className="mr-1 h-3 w-3" />
          Low Stock
        </Badge>
      );
    return (
      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Active
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your product catalog, variants, and inventory
          </p>
        </div>
        <Link href="/admin/products/new">
          <Button className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Products", value: pagination.total, icon: Package, color: "text-slate-600", bg: "bg-slate-50" },
          { label: "Active", value: stats.active, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Out of Stock", value: stats.outOfStock, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
          { label: "With Variants", value: stats.withVariants, icon: Layers, color: "text-blue-600", bg: "bg-blue-50" },
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

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-10"
          />
          {search && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-[160px]">
              <Filter className="mr-2 h-3.5 w-3.5 text-slate-400" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[130px]">
              <TrendingUp className="mr-2 h-3.5 w-3.5 text-slate-400" />
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500 h-9">
              <X className="mr-1 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Product
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Category
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Price
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Stock
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Type
                </th>
                <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-11 w-11 rounded-lg shrink-0" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-36" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-10" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-4 text-right"><Skeleton className="ml-auto h-8 w-20 rounded-md" /></td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                        <Package className="h-8 w-8 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700">No products found</p>
                        <p className="text-sm text-slate-400 mt-0.5">
                          {hasActiveFilters ? "Try adjusting or clearing your filters" : "Add your first product to get started"}
                        </p>
                      </div>
                      {hasActiveFilters ? (
                        <Button variant="outline" size="sm" onClick={clearFilters}>
                          Clear Filters
                        </Button>
                      ) : (
                        <Link href="/admin/products/new">
                          <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" />
                            Add Product
                          </Button>
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const stock = getTotalStock(product);
                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-slate-50 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/admin/products/${product.id}`)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 border border-slate-200 overflow-hidden">
                            {product.images[0] ? (
                              <img
                                src={product.images[0]}
                                alt={product.name}
                                className="h-11 w-11 object-cover"
                              />
                            ) : (
                              <ImageIcon className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 max-w-[200px]">
                            <p className="font-medium text-slate-900 truncate leading-tight">
                              {product.name}
                            </p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                              {product.sku}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-sm text-slate-600">
                          {product.category.name}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900 tabular-nums">
                          {currencyFormatter.format(product.basePrice)}
                        </p>
                        {product.memberPrice && (
                          <p className="text-xs text-emerald-600 mt-0.5">
                            ₹{product.memberPrice.toLocaleString()} member
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {getStockDisplay(stock)}
                      </td>
                      <td className="px-4 py-3.5">
                        {getStatusBadge(product.isActive, stock)}
                      </td>
                      <td className="px-4 py-3.5">
                        {product.hasVariants ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                            <Layers className="h-3 w-3" />
                            {product._count.productVariants} variant{product._count.productVariants !== 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Simple</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/products/${product.slug}`} target="_blank">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900" title="View on store">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Link href={`/admin/products/${product.id}`}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900" title="Edit product">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-slate-500 hover:text-red-600"
                            title="Delete product"
                            onClick={() => {
                              setProductToDelete({ id: product.id, name: product.name });
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && products.length > 0 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-5 py-3">
            <p className="text-sm text-slate-500">
              Showing{" "}
              <span className="font-medium text-slate-700">
                {(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-slate-700">{pagination.total}</span> products
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Prev</span>
              </Button>
              <span className="px-3 text-sm font-medium text-slate-700">
                {page} / {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
                className="h-8"
              >
                <span className="mr-1 hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              Delete Product
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-slate-800">"{productToDelete?.name}"</span>?
                </p>
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-700">
                    This will permanently remove the product and all associated variants and data.
                    <strong className="block mt-0.5">This action cannot be undone.</strong>
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} onClick={() => setProductToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>
              ) : (
                <><Trash2 className="mr-2 h-4 w-4" />Delete Product</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

