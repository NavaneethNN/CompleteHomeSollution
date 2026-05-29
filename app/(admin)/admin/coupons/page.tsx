"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Tag,
  Calendar,
  Percent,
  DollarSign,
  Package,
  Layers,
  Globe,
  Trash2,
  Pencil,
  Copy,
  Check,
  X,
  ChevronDown,
  ChevronUp,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: "GLOBAL" | "PRODUCT" | "CATEGORY";
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  createdAt: string;
  products: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}

interface Product {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

const currencyFormatter = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

export default function AdminCouponsPage() {
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    type: "GLOBAL" as "GLOBAL" | "PRODUCT" | "CATEGORY",
    discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED",
    discountValue: "",
    minOrderAmount: "",
    maxDiscount: "",
    usageLimit: "",
    perUserLimit: "",
    startDate: "",
    endDate: "",
    isActive: true,
    productIds: [] as string[],
    categoryIds: [] as string[],
  });

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/coupons");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCoupons(data.coupons);
    } catch {
      toast.error("Failed to load coupons");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/products?limit=100");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setProducts(data.products.map((p: any) => ({ id: p.id, name: p.name })));
    } catch {
      toast.error("Failed to load products");
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCategories(data.categories.map((c: any) => ({ id: c.id, name: c.name })));
    } catch {
      toast.error("Failed to load categories");
    }
  }, []);

  useEffect(() => {
    fetchCoupons();
    fetchProducts();
    fetchCategories();
  }, [fetchCoupons, fetchProducts, fetchCategories]);

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      type: "GLOBAL",
      discountType: "PERCENTAGE",
      discountValue: "",
      minOrderAmount: "",
      maxDiscount: "",
      usageLimit: "",
      perUserLimit: "",
      startDate: "",
      endDate: "",
      isActive: true,
      productIds: [],
      categoryIds: [],
    });
  };

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          discountValue: parseFloat(formData.discountValue),
          minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : null,
          maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : null,
          usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
          perUserLimit: formData.perUserLimit ? parseInt(formData.perUserLimit) : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create");
      }

      toast.success("Coupon created");
      setIsCreateDialogOpen(false);
      resetForm();
      fetchCoupons();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleUpdate = async () => {
    if (!selectedCoupon) return;

    try {
      const res = await fetch(`/api/admin/coupons/${selectedCoupon.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          discountValue: parseFloat(formData.discountValue),
          minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : null,
          maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : null,
          usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
          perUserLimit: formData.perUserLimit ? parseInt(formData.perUserLimit) : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update");
      }

      toast.success("Coupon updated");
      setIsEditDialogOpen(false);
      setSelectedCoupon(null);
      resetForm();
      fetchCoupons();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedCoupon) return;

    try {
      const res = await fetch(`/api/admin/coupons/${selectedCoupon.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      toast.success("Coupon deleted");
      setIsDeleteDialogOpen(false);
      setSelectedCoupon(null);
      fetchCoupons();
    } catch {
      toast.error("Failed to delete coupon");
    }
  };

  const openEditDialog = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setFormData({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description || "",
      type: coupon.type,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue.toString(),
      minOrderAmount: coupon.minOrderAmount?.toString() || "",
      maxDiscount: coupon.maxDiscount?.toString() || "",
      usageLimit: coupon.usageLimit?.toString() || "",
      perUserLimit: coupon.perUserLimit?.toString() || "",
      startDate: coupon.startDate?.split("T")[0] || "",
      endDate: coupon.endDate?.split("T")[0] || "",
      isActive: coupon.isActive,
      productIds: coupon.products.map((p) => p.id),
      categoryIds: coupon.categories.map((c) => c.id),
    });
    setIsEditDialogOpen(true);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredCoupons = coupons.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
  );

  const getCouponTypeIcon = (type: string) => {
    switch (type) {
      case "GLOBAL":
        return <Globe className="h-4 w-4" />;
      case "PRODUCT":
        return <Package className="h-4 w-4" />;
      case "CATEGORY":
        return <Layers className="h-4 w-4" />;
      default:
        return <Tag className="h-4 w-4" />;
    }
  };

  const getDiscountDisplay = (coupon: Coupon) => {
    if (coupon.discountType === "PERCENTAGE") {
      return `${coupon.discountValue}% off`;
    }
    return currencyFormatter.format(coupon.discountValue) + " off";
  };

  const isExpired = (coupon: Coupon) => {
    if (coupon.endDate && new Date() > new Date(coupon.endDate)) return true;
    return false;
  };

  const isNotStarted = (coupon: Coupon) => {
    if (coupon.startDate && new Date() < new Date(coupon.startDate)) return true;
    return false;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coupons</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage discount coupons for products and categories
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Create Coupon
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: coupons.length, icon: Tag, color: "text-slate-600", bg: "bg-slate-50" },
          { label: "Active", value: coupons.filter((c) => c.isActive && !isExpired(c)).length, icon: Tag, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Expired", value: coupons.filter((c) => isExpired(c)).length, icon: Calendar, color: "text-red-600", bg: "bg-red-50" },
          { label: "Scheduled", value: coupons.filter((c) => isNotStarted(c)).length, icon: Calendar, color: "text-amber-600", bg: "bg-amber-50" },
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search coupons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Coupons List */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="p-8 text-center">
            <Tag className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 font-medium">No coupons found</p>
            <p className="text-sm text-slate-400 mt-1">
              {search ? "Try a different search term" : "Create your first coupon to get started"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCoupons.map((coupon) => {
              const expired = isExpired(coupon);
              const notStarted = isNotStarted(coupon);
              const isExpanded = expandedId === coupon.id;

              return (
                <div key={coupon.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="px-2 py-0.5 bg-slate-100 rounded text-sm font-mono font-semibold text-slate-900">
                          {coupon.code}
                        </code>
                        <button
                          onClick={() => copyCode(coupon.code)}
                          className="text-slate-400 hover:text-slate-600"
                          title="Copy code"
                        >
                          {copiedCode === coupon.code ? (
                            <Check className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <span className="font-medium text-slate-900">{coupon.name}</span>
                        {!coupon.isActive && (
                          <Badge variant="outline" className="text-slate-500">Inactive</Badge>
                        )}
                        {expired && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                        {notStarted && (
                          <Badge variant="secondary">Scheduled</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className={`inline-flex items-center gap-1 ${coupon.discountType === "PERCENTAGE" ? "text-emerald-600" : "text-blue-600"}`}>
                          {coupon.discountType === "PERCENTAGE" ? (
                            <Percent className="h-3.5 w-3.5" />
                          ) : (
                            <DollarSign className="h-3.5 w-3.5" />
                          )}
                          {getDiscountDisplay(coupon)}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          {getCouponTypeIcon(coupon.type)}
                          {coupon.type === "GLOBAL" ? "All products" : coupon.type === "PRODUCT" ? `${coupon.products.length} products` : `${coupon.categories.length} categories`}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-600">
                          Used {coupon.usageCount} times
                          {coupon.usageLimit && ` / ${coupon.usageLimit}`}
                        </span>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 space-y-2 text-sm">
                          {coupon.description && (
                            <p className="text-slate-600">{coupon.description}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-500">
                            {coupon.minOrderAmount && (
                              <span>Min order: {currencyFormatter.format(coupon.minOrderAmount)}</span>
                            )}
                            {coupon.maxDiscount && coupon.discountType === "PERCENTAGE" && (
                              <span>Max discount: {currencyFormatter.format(coupon.maxDiscount)}</span>
                            )}
                            {coupon.perUserLimit && (
                              <span>Per user: {coupon.perUserLimit} uses</span>
                            )}
                            {coupon.startDate && (
                              <span>Starts: {new Date(coupon.startDate).toLocaleDateString()}</span>
                            )}
                            {coupon.endDate && (
                              <span>Ends: {new Date(coupon.endDate).toLocaleDateString()}</span>
                            )}
                          </div>
                          {(coupon.products.length > 0 || coupon.categories.length > 0) && (
                            <div className="mt-2">
                              {coupon.products.length > 0 && (
                                <div className="mb-1">
                                  <span className="text-slate-500">Products:</span>{" "}
                                  <span className="text-slate-700">
                                    {coupon.products.map((p) => p.name).join(", ")}
                                  </span>
                                </div>
                              )}
                              {coupon.categories.length > 0 && (
                                <div>
                                  <span className="text-slate-500">Categories:</span>{" "}
                                  <span className="text-slate-700">
                                    {coupon.categories.map((c) => c.name).join(", ")}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : coupon.id)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                        title={isExpanded ? "Show less" : "Show more"}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => openEditDialog(coupon)}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setSelectedCoupon(coupon); setIsDeleteDialogOpen(true); }}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Coupon</DialogTitle>
            <DialogDescription>Create a new discount coupon</DialogDescription>
          </DialogHeader>
          <CouponForm
            formData={formData}
            setFormData={setFormData}
            products={products}
            categories={categories}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formData.code || !formData.name || !formData.discountValue}>
              Create Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Coupon</DialogTitle>
            <DialogDescription>Update coupon details</DialogDescription>
          </DialogHeader>
          <CouponForm
            formData={formData}
            setFormData={setFormData}
            products={products}
            categories={categories}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={!formData.code || !formData.name || !formData.discountValue}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Coupon</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the coupon &quot;{selectedCoupon?.code}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 text-white hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Coupon Form Component
function CouponForm({
  formData,
  setFormData,
  products,
  categories,
}: {
  formData: any;
  setFormData: (data: any) => void;
  products: Product[];
  categories: Category[];
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Code *</label>
          <Input
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            placeholder="e.g., SAVE10"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Name *</label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Summer Sale 10%"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Optional description"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Coupon Type</label>
          <Select
            value={formData.type}
            onValueChange={(value) => setFormData({ ...formData, type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GLOBAL">All Products</SelectItem>
              <SelectItem value="PRODUCT">Specific Products</SelectItem>
              <SelectItem value="CATEGORY">Specific Categories</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Discount Type</label>
          <Select
            value={formData.discountType}
            onValueChange={(value) => setFormData({ ...formData, discountType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
              <SelectItem value="FIXED">Fixed Amount ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {formData.discountType === "PERCENTAGE" ? "Discount Percentage *" : "Discount Amount *"}
          </label>
          <Input
            type="number"
            min="0"
            step={formData.discountType === "PERCENTAGE" ? "1" : "0.01"}
            value={formData.discountValue}
            onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
            placeholder={formData.discountType === "PERCENTAGE" ? "e.g., 10" : "e.g., 20.00"}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Max Discount Cap</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formData.maxDiscount}
            onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
            placeholder="For percentage coupons"
            disabled={formData.discountType === "FIXED"}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Minimum Order Amount</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={formData.minOrderAmount}
            onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Usage Limit (Total)</label>
          <Input
            type="number"
            min="0"
            value={formData.usageLimit}
            onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Per User Limit</label>
          <Input
            type="number"
            min="0"
            value={formData.perUserLimit}
            onChange={(e) => setFormData({ ...formData, perUserLimit: e.target.value })}
            placeholder="Optional"
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
          />
          <label className="text-sm font-medium">Active</label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Start Date</label>
          <Input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">End Date</label>
          <Input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          />
        </div>
      </div>

      {formData.type === "PRODUCT" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Products</label>
          <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
            {products.map((product) => (
              <label key={product.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded">
                <input
                  type="checkbox"
                  checked={formData.productIds.includes(product.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({ ...formData, productIds: [...formData.productIds, product.id] });
                    } else {
                      setFormData({ ...formData, productIds: formData.productIds.filter((id: string) => id !== product.id) });
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm">{product.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {formData.type === "CATEGORY" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Categories</label>
          <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
            {categories.map((category) => (
              <label key={category.id} className="flex items-center gap-2 p-1 hover:bg-slate-50 rounded">
                <input
                  type="checkbox"
                  checked={formData.categoryIds.includes(category.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFormData({ ...formData, categoryIds: [...formData.categoryIds, category.id] });
                    } else {
                      setFormData({ ...formData, categoryIds: formData.categoryIds.filter((id: string) => id !== category.id) });
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm">{category.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
