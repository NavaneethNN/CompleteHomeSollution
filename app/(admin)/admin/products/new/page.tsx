"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  X,
  Check,
  ChevronDown,
  Package,
  DollarSign,
  Palette,
  Layers,
  Ruler,
  Save,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ImageUploader } from "@/components/admin/image-uploader";
import type { Category } from "@prisma/client";

interface VariantAttribute {
  id: string;
  name: string;
  displayOrder: number;
  values: { id: string; value: string; hexCode?: string; images?: string[] }[];
}

interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  comparePrice?: number;
  memberPrice?: number;
  stock: number;
  isActive: boolean;
  valueIds: string[];
  images: string[];
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
}

function VariantCard({
  variant,
  label,
  onUpdate,
  primaryImages,
  primaryLabel,
}: {
  variant: ProductVariant;
  label: string;
  onUpdate: (updates: Partial<ProductVariant>) => void;
  primaryImages?: string[];   // images inherited from the primary attribute value
  primaryLabel?: string;      // e.g. "Black" — shown in the inherited badge
}) {
  const [expanded, setExpanded] = useState(false);
  const effectiveImages = primaryImages && primaryImages.length > 0 ? primaryImages : variant.images;
  const hasImages = effectiveImages && effectiveImages.length > 0;

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      {/* Header row — always visible */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-slate-50 cursor-pointer select-none hover:bg-slate-100 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Thumbnail */}
        <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden border border-slate-200 bg-white flex items-center justify-center">
          {hasImages ? (
            <img src={effectiveImages[0]} alt="" className="h-full w-full object-cover" />
          ) : (
            <Package className="h-5 w-5 text-slate-300" />
          )}
        </div>

        <span className="flex-1 text-sm font-medium text-slate-700">{label}</span>

        {/* Quick stats */}
        <span className="text-xs text-slate-400 hidden sm:inline">
          {primaryImages && primaryImages.length > 0
            ? <span className="text-primary/70">↑ {primaryLabel}</span>
            : hasImages ? `${variant.images.length} img` : "No images"}
        </span>
        <span className="text-xs text-slate-400 hidden sm:inline">Stock: {variant.stock}</span>
        <Switch
          checked={variant.isActive}
          onCheckedChange={(checked: boolean) => {
            onUpdate({ isActive: checked });
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <ChevronDown
          className={cn("h-4 w-4 text-slate-400 transition-transform shrink-0", expanded && "rotate-180")}
        />
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="p-4 space-y-4 border-t border-slate-200">
          {/* SKU + Price + Stock row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">SKU</Label>
              <Input
                value={variant.sku}
                onChange={(e) => onUpdate({ sku: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Price (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={variant.price ?? ""}
                onChange={(e) => onUpdate({ price: parseFloat(e.target.value) || 0 })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Stock</Label>
              <Input
                type="number"
                min="0"
                value={variant.stock}
                onFocus={(e) => variant.stock === 0 && e.target.select()}
                onChange={(e) => onUpdate({ stock: parseInt(e.target.value) || 0 })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Compare Price (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={variant.comparePrice ?? ""}
                onChange={(e) =>
                  onUpdate({ comparePrice: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                className="h-8 text-xs"
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Member Price (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={variant.memberPrice ?? ""}
                onChange={(e) =>
                  onUpdate({ memberPrice: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                className="h-8 text-xs"
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Variant Images */}
          <div className="space-y-2">
            {primaryImages && primaryImages.length > 0 ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0" />
                Images inherited from <strong>{primaryLabel}</strong> — set them on the primary attribute value above.
              </div>
            ) : (
              <>
                <Label className="text-xs font-medium text-slate-600">Variant Images</Label>
                <ImageUploader
                  images={variant.images ?? []}
                  onChange={(imgs) => onUpdate({ images: imgs })}
                  maxImages={5}
                  folder="products/variants"
                />
              </>
            )}
          </div>

          {/* Variant Dimensions */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5" />
              Dimensions &amp; Weight
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Weight (kg)</Label>
                <Input
                  type="number" min="0" step="0.1"
                  value={variant.weight ?? ""}
                  onChange={(e) => onUpdate({ weight: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="h-8 text-xs" placeholder="0.0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Length (cm)</Label>
                <Input
                  type="number" min="0"
                  value={variant.length ?? ""}
                  onChange={(e) => onUpdate({ length: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="h-8 text-xs" placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Width (cm)</Label>
                <Input
                  type="number" min="0"
                  value={variant.width ?? ""}
                  onChange={(e) => onUpdate({ width: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="h-8 text-xs" placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Height (cm)</Label>
                <Input
                  type="number" min="0"
                  value={variant.height ?? ""}
                  onChange={(e) => onUpdate({ height: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="h-8 text-xs" placeholder="0"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = searchParams.get("id");
  const isEditMode = !!productId;
  
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<"basic" | "variants" | "shipping">("basic");

  // Basic product info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sku, setSku] = useState("");
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(false);
  const [basePrice, setBasePrice] = useState("");
  const [comparePrice, setComparePrice] = useState("");
  const [memberPrice, setMemberPrice] = useState("");
  const [stock, setStock] = useState("");
  const [material, setMaterial] = useState("");
  const [roomType, setRoomType] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [hasVariants, setHasVariants] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  // Shipping
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");

  // Variants
  const [variantAttributes, setVariantAttributes] = useState<VariantAttribute[]>([]);
  const [productVariants, setProductVariants] = useState<ProductVariant[]>([]);
  const [newAttributeName, setNewAttributeName] = useState("");
  const [newValueName, setNewValueName] = useState("");
  const [newValueHex, setNewValueHex] = useState("");
  const [selectedAttributeId, setSelectedAttributeId] = useState<string | null>(null);
  const [primaryAttributeId, setPrimaryAttributeId] = useState<string | null>(null);

  // Fetch categories
  useEffect(() => {
    fetch("/api/admin/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data.categories))
      .catch(() => toast.error("Failed to load categories"));
  }, []);

  // Auto-generate SKU from product name
  useEffect(() => {
    if (isEditMode || skuManuallyEdited || !name) return;
    
    // Generate SKU: Take first 3 chars of each word, uppercase, add random 3 digits
    const words = name.trim().split(/\s+/).filter(w => w.length > 0);
    const prefix = words
      .slice(0, 3)
      .map(w => w.substring(0, 3).toUpperCase())
      .join('-');
    const randomNum = Math.floor(100 + Math.random() * 900); // 100-999
    setSku(`${prefix}-${randomNum}`);
  }, [name, isEditMode, skuManuallyEdited]);

  // Load product data in edit mode
  useEffect(() => {
    if (!isEditMode || !productId) return;
    
    setLoading(true);
    fetch(`/api/admin/products/${productId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load product");
        return res.json();
      })
      .then((data) => {
        const p = data.product;
        setName(p.name);
        setDescription(p.description);
        setCategoryId(p.categoryId);
        setSku(p.sku);
        setBasePrice(p.basePrice?.toString() || "");
        setComparePrice(p.comparePrice?.toString() || "");
        setMemberPrice(p.memberPrice?.toString() || "");
        setStock(p.stock?.toString() || "");
        setMaterial(p.material || "");
        setRoomType(p.roomType || "");
        setIsActive(p.isActive);
        setHasVariants(p.hasVariants);
        setImages(p.images || []);
        setWeight(p.weight?.toString() || "");
        setLength(p.length?.toString() || "");
        setWidth(p.width?.toString() || "");
        setHeight(p.height?.toString() || "");
        
        // Load variant attributes if present
        if (p.variantAttributes) {
          const attrs = p.variantAttributes.map((attr: any) => ({
            id: attr.id,
            name: attr.name,
            displayOrder: attr.displayOrder,
            isPrimary: attr.isPrimary ?? false,
            values: (attr.variantValues || []).map((v: any) => ({
              id: v.id,
              value: v.value,
              hexCode: v.hexCode,
              images: v.images || [],
            })),
          }));
          setVariantAttributes(attrs);
          const primary = attrs.find((a: any) => a.isPrimary);
          if (primary) setPrimaryAttributeId(primary.id);
        }
        
        // Load product variants if present
        if (p.productVariants) {
          setProductVariants(p.productVariants.map((v: any) => {
            const valueIds: string[] = v.values?.map((val: any) => val.variantValueId) || [];
            // Normalize ID to match makeVariantId() so isVariantActive() works correctly
            const normalizedId = `var-${[...valueIds].sort().join("-")}`;
            return {
              id: normalizedId,
              sku: v.sku,
              price: v.price,
              comparePrice: v.comparePrice,
              memberPrice: v.memberPrice,
              stock: v.stock,
              isActive: v.isActive,
              valueIds,
              images: v.images?.map((img: any) => img.url) || [],
              weight: v.weight,
              length: v.length,
              width: v.width,
              height: v.height,
            };
          }));
        }
      })
      .catch((err) => {
        console.error("[Edit Product] Error loading product:", err);
        toast.error("Failed to load product");
      })
      .finally(() => setLoading(false));
    
    // Cleanup function to handle component unmount
    return () => {
      setLoading(false);
    };
  }, [isEditMode, productId]);

  // When attributes change, clean up orphan variants
  useEffect(() => {
    if (!hasVariants || variantAttributes.length === 0) {
      setProductVariants([]);
      return;
    }
    const allValueIds = new Set(variantAttributes.flatMap((a) => a.values.map((v) => v.id)));
    const expectedLength = variantAttributes.length;
    setProductVariants((prev) =>
      prev.filter(
        (variant) =>
          // Must reference only known value IDs
          variant.valueIds.every((id) => allValueIds.has(id)) &&
          // Must have exactly one value per attribute
          variant.valueIds.length === expectedLength
      )
    );
  }, [variantAttributes, hasVariants]);

  const makeVariantId = (valueIds: string[]) => `var-${[...valueIds].sort().join("-")}`;

  const isVariantActive = (valueIds: string[]) => {
    const id = makeVariantId(valueIds);
    return productVariants.some((v) => v.id === id);
  };

  const toggleVariant = (valueIds: string[]) => {
    const id = makeVariantId(valueIds);
    const exists = productVariants.find((v) => v.id === id);
    if (exists) {
      setProductVariants((prev) => prev.filter((v) => v.id !== id));
    } else {
      const suffix = valueIds
        .map((vid) => {
          for (const attr of variantAttributes) {
            const val = attr.values.find((v) => v.id === vid);
            if (val) return val.value.substring(0, 3).toUpperCase();
          }
          return "";
        })
        .join("-");
      const ts = Date.now().toString(36).slice(-4).toUpperCase();
      const variantSku = sku.trim() ? `${sku}-${suffix}-${ts}` : `VAR-${suffix}-${ts}`;
      const newVariant: ProductVariant = {
        id,
        sku: variantSku,
        price: parseFloat(basePrice) || 0,
        stock: 0,
        isActive: true,
        valueIds,
        images: [],
      };
      setProductVariants((prev) => [...prev, newVariant]);
    }
  };

  const addAllCombinationsForValue = (primaryAttrId: string, primaryValueId: string) => {
    // Find the secondary attribute (the one that isn't primary)
    const secondaryAttrs = variantAttributes.filter((a) => a.id !== primaryAttrId);
    if (secondaryAttrs.length === 0) {
      // Single attribute product — just toggle the single value
      toggleVariant([primaryValueId]);
      return;
    }
    // Add all secondary combinations for this primary value
    const getCombinations = (attrs: VariantAttribute[]): string[][] => {
      if (attrs.length === 0) return [[]];
      const [first, ...rest] = attrs;
      return first.values.flatMap((v) => getCombinations(rest).map((c) => [v.id, ...c]));
    };
    getCombinations(secondaryAttrs).forEach((secIds) => {
      const valueIds = [primaryValueId, ...secIds];
      if (!isVariantActive(valueIds)) toggleVariant(valueIds);
    });
  };

  const updateAttributeValueImages = (attrId: string, valueId: string, imgs: string[]) => {
    setVariantAttributes((prev) =>
      prev.map((attr) =>
        attr.id !== attrId ? attr : {
          ...attr,
          values: attr.values.map((v) =>
            v.id !== valueId ? v : { ...v, images: imgs }
          ),
        }
      )
    );
  };

  const addVariantAttribute = () => {
    if (!newAttributeName.trim()) return;
    if (variantAttributes.length >= 3) {
      toast.error("Maximum 3 option types allowed");
      return;
    }
    const newAttr: VariantAttribute = {
      id: `attr-${Date.now()}`,
      name: newAttributeName,
      displayOrder: variantAttributes.length,
      values: [],
    };
    setVariantAttributes([...variantAttributes, newAttr]);
    setNewAttributeName("");
    setSelectedAttributeId(newAttr.id);
  };

  const removeVariantAttribute = (id: string) => {
    setVariantAttributes(variantAttributes.filter((a) => a.id !== id));
    if (selectedAttributeId === id) setSelectedAttributeId(null);
  };

  const addVariantValue = () => {
    if (!selectedAttributeId || !newValueName.trim()) return;

    setVariantAttributes(
      variantAttributes.map((attr) =>
        attr.id === selectedAttributeId
          ? {
              ...attr,
              values: [
                ...attr.values,
                {
                  id: `val-${Date.now()}`,
                  value: newValueName,
                  hexCode: newValueHex || undefined,
                },
              ],
            }
          : attr
      )
    );
    setNewValueName("");
    setNewValueHex("");
  };

  const removeVariantValue = (attrId: string, valueId: string) => {
    setVariantAttributes(
      variantAttributes.map((attr) =>
        attr.id === attrId
          ? { ...attr, values: attr.values.filter((v) => v.id !== valueId) }
          : attr
      )
    );
  };

  const updateVariant = (id: string, updates: Partial<ProductVariant>) => {
    setProductVariants(
      productVariants.map((v) => (v.id === id ? { ...v, ...updates } : v))
    );
  };

  const getVariantLabel = (variant: ProductVariant) => {
    return variant.valueIds
      .map((id) => {
        for (const attr of variantAttributes) {
          const val = attr.values.find((v) => v.id === id);
          if (val) return `${attr.name}: ${val.value}`;
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
  };

  // Security constants
  const MAX_NAME_LENGTH = 200;
  const MAX_DESCRIPTION_LENGTH = 5000;

  // Sanitize string inputs to prevent XSS
  const sanitizeInput = (input: string): string => {
    return input
      .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
      .trim();
  };

  // Validate input lengths
  const validateInputLength = (input: string, fieldName: string, maxLength: number): boolean => {
    if (input.length > maxLength) {
      toast.error(`${fieldName} must not exceed ${maxLength} characters`);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    // Validation
    if (!name.trim() || !categoryId || !sku.trim()) {
      toast.error("Please fill in required fields: Name, Category, SKU");
      return;
    }

    // Validate input lengths
    if (!validateInputLength(name, "Product name", MAX_NAME_LENGTH)) return;
    if (!validateInputLength(description, "Description", MAX_DESCRIPTION_LENGTH)) return;
    if (!validateInputLength(sku, "SKU", 50)) return;

    // Validate SKU format (alphanumeric, hyphens, underscores only)
    const skuRegex = /^[a-zA-Z0-9-_]+$/;
    if (!skuRegex.test(sku)) {
      toast.error("SKU can only contain letters, numbers, hyphens, and underscores");
      return;
    }

    // Validate prices are not negative
    const basePriceNum = parseFloat(basePrice);
    if (basePriceNum < 0) {
      toast.error("Base price cannot be negative");
      return;
    }
    
    setLoading(true);
    try {
      const productData = {
        name: sanitizeInput(name),
        description: description ? sanitizeInput(description) : undefined,
        basePrice: parseFloat(basePrice) || 0,
        comparePrice: comparePrice ? parseFloat(comparePrice) : undefined,
        memberPrice: memberPrice ? parseFloat(memberPrice) : undefined,
        stock: parseInt(stock) || 0,
        sku,
        categoryId,
        material: material || undefined,
        roomType: roomType || undefined,
        isActive,
        hasVariants,
        images,
        weight: weight ? parseFloat(weight) : undefined,
        length: length ? parseFloat(length) : undefined,
        width: width ? parseFloat(width) : undefined,
        height: height ? parseFloat(height) : undefined,
        // Always send variant arrays in edit mode so the API can clean up deleted variants.
        // In create mode, omit when not needed to keep payload minimal.
        variantAttributes: (hasVariants || isEditMode)
          ? variantAttributes.map((attr) => ({
              id: attr.id,
              name: attr.name,
              displayOrder: attr.displayOrder,
              isPrimary: attr.id === primaryAttributeId,
              values: attr.values.map((v) => ({
                id: v.id,
                value: v.value,
                hexCode: v.hexCode,
                images: v.images ?? [],
              })),
            }))
          : undefined,
        productVariants: (hasVariants || isEditMode)
          ? productVariants.map((v) => {
              // Propagate primary-value images into variant so the API stores them
              const primaryAttr = primaryAttributeId
                ? variantAttributes.find((a) => a.id === primaryAttributeId)
                : null;
              const primaryVal = primaryAttr
                ? primaryAttr.values.find((pv) => v.valueIds.includes(pv.id))
                : null;
              const resolvedImages = primaryVal?.images?.length
                ? primaryVal.images
                : v.images;
              return {
                sku: v.sku,
                price: v.price,
                comparePrice: v.comparePrice,
                memberPrice: v.memberPrice,
                stock: v.stock,
                isActive: v.isActive,
                valueIds: v.valueIds,
                images: resolvedImages,
                weight: v.weight,
                length: v.length,
                width: v.width,
                height: v.height,
              };
            })
          : undefined,
      };

      const url = isEditMode ? `/api/admin/products/${productId}` : "/api/admin/products";
      const method = isEditMode ? "PUT" : "POST";
      
      console.log("[handleSubmit] Sending product data:", JSON.stringify(productData, null, 2));
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productData),
      });

      if (!res.ok) {
        let errorData;
        try {
          errorData = await res.json();
        } catch {
          errorData = {};
        }
        console.error("API Error:", errorData);
        let errorMessage = errorData.error || errorData.message || `Failed to ${isEditMode ? "update" : "create"} product (status: ${res.status})`;
        if (errorData.details && Array.isArray(errorData.details)) {
          const details = errorData.details.map((d: any) => `${d.path?.join('.')}: ${d.message}`).join(', ');
          errorMessage += ` - ${details}`;
        }
        throw new Error(errorMessage);
      }

      toast.success(`Product ${isEditMode ? "updated" : "created"} successfully`);
      router.push("/admin/products");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/products">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{isEditMode ? "Edit Product" : "Create Product"}</h1>
            <p className="text-sm text-slate-500">{isEditMode ? "Update product details" : "Add a new product to your catalog"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/products">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleSubmit} disabled={loading} className="bg-primary">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {isEditMode ? "Update Product" : "Create Product"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {[
          { id: "basic", label: "Basic Info", icon: Package },
          { id: "variants", label: "Variants", icon: Layers },
          { id: "shipping", label: "Shipping", icon: Ruler },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Basic Info Tab */}
      {activeTab === "basic" && (
        <div className="space-y-6">
          {/* Product Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Product Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Active Product</Label>
                  <p className="text-sm text-slate-500">
                    This product will be visible in your store
                  </p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Product Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Product Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Product Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. King Size Platform Bed"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sku">
                    SKU <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="sku"
                    value={sku}
                    onChange={(e) => {
                      setSku(e.target.value.toUpperCase());
                      setSkuManuallyEdited(true);
                    }}
                    placeholder="e.g. BD-KING-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                    placeholder="Describe your product..."
                    rows={5}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="basePrice">Base Price ($)</Label>
                    <Input
                      id="basePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comparePrice">Compare Price ($)</Label>
                    <Input
                      id="comparePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={comparePrice}
                      onChange={(e) => setComparePrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="memberPrice">Member Price ($)</Label>
                  <Input
                    id="memberPrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={memberPrice}
                    onChange={(e) => setMemberPrice(e.target.value)}
                    placeholder="Special price for members"
                  />
                  <p className="text-xs text-slate-500">
                    Leave empty to use base price for members
                  </p>
                </div>

                {!hasVariants && (
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock Quantity</Label>
                    <Input
                      id="stock"
                      type="number"
                      min="0"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="material">Material</Label>
                    <Input
                      id="material"
                      value={material}
                      onChange={(e) => setMaterial(e.target.value)}
                      placeholder="e.g. Solid Pine"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="roomType">Room Type</Label>
                    <Input
                      id="roomType"
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value)}
                      placeholder="e.g. Bedroom"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Images */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Product Images</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUploader
                images={images}
                onChange={setImages}
                maxImages={10}
                folder="products"
              />
            </CardContent>
          </Card>

          {/* Variants Toggle */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Product Variants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>This product has variants</Label>
                  <p className="text-sm text-slate-500">
                    e.g. different sizes, colors, or materials
                  </p>
                </div>
                <Switch checked={hasVariants} onCheckedChange={setHasVariants} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Variants Tab */}
      {activeTab === "variants" && hasVariants && (
        <div className="space-y-6">

          {/* Step 1 — Define option types */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Step 1 — Define Option Types
              </CardTitle>
              <p className="text-sm text-slate-500">Add the kinds of options your product has (e.g. Color, Size).</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {variantAttributes.length < 3 ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Color, Size, Material"
                    value={newAttributeName}
                    onChange={(e) => setNewAttributeName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addVariantAttribute()}
                  />
                  <Button onClick={addVariantAttribute} type="button">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Option
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-slate-400 border border-dashed border-slate-200 rounded-lg px-4 py-2.5">
                  Maximum of 3 option types added. Remove one to add a different type.
                </p>
              )}
              {variantAttributes.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs text-slate-500">Select which option is <strong>Primary</strong> — its values will share images (e.g. all Black variants use one image set).</p>
                  <div className="flex flex-wrap gap-2">
                    {variantAttributes.map((attr) => {
                      const isPrimary = primaryAttributeId === attr.id;
                      return (
                        <div
                          key={attr.id}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium cursor-pointer transition-all",
                            isPrimary
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                          )}
                          onClick={() => setPrimaryAttributeId(isPrimary ? null : attr.id)}
                        >
                          {isPrimary && <Check className="h-3.5 w-3.5 shrink-0" />}
                          {attr.name}
                          {isPrimary && <span className="text-[10px] font-semibold bg-primary text-white rounded px-1 ml-0.5">PRIMARY</span>}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeVariantAttribute(attr.id); }}
                            className="ml-1 text-slate-400 hover:text-red-500"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2 — Add values and pick combinations */}
          {variantAttributes.length > 0 && (() => {
            const primaryAttr = variantAttributes[0];
            const secondaryAttrs = variantAttributes.slice(1);
            return (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Step 2 — Add Values &amp; Select Combinations
                  </CardTitle>
                  <p className="text-sm text-slate-500">
                    Add values for each option type, then tick which combinations exist for this product.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">

                  {/* Value input panels for each attribute */}
                  {variantAttributes.map((attr) => {
                    const isThisPrimary = primaryAttributeId === attr.id;
                    return (
                    <div key={attr.id} className={cn("rounded-lg border border-dashed p-3 space-y-2", isThisPrimary ? "border-primary/40 bg-primary/5" : "border-slate-300")}>
                      <div className="flex items-center justify-between">
                        <p className={cn("text-xs font-semibold uppercase tracking-wide", isThisPrimary ? "text-primary" : "text-slate-500")}>
                          {attr.name} Values
                          {isThisPrimary && <span className="ml-2 normal-case font-normal text-primary/70">— images set per value below</span>}
                        </p>
                        {variantAttributes.indexOf(attr) > 0 && (
                          <button type="button" onClick={() => removeVariantAttribute(attr.id)} className="text-slate-400 hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {/* If primary: show each value as a card with its own image uploader */}
                      {isThisPrimary && attr.values.length > 0 ? (
                        <div className="space-y-3">
                          {attr.values.map((val) => (
                            <div key={val.id} className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                  {val.hexCode && <span className="h-4 w-4 rounded-full border border-slate-200 shrink-0" style={{ background: val.hexCode }} />}
                                  {val.value}
                                </div>
                                <button type="button" onClick={() => removeVariantValue(attr.id, val.id)} className="text-slate-400 hover:text-red-500">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <ImageUploader
                                images={val.images ?? []}
                                onChange={(imgs) => updateAttributeValueImages(attr.id, val.id, imgs)}
                                maxImages={5}
                                folder="products/variants"
                              />
                            </div>
                          ))}
                        </div>
                      ) : !isThisPrimary ? (
                        <div className="flex flex-wrap gap-2">
                          {attr.values.map((val) => (
                            <Badge key={val.id} variant="secondary" className="gap-1.5 pr-1">
                              {val.hexCode && <span className="inline-block h-3 w-3 rounded-full border border-white/50" style={{ background: val.hexCode }} />}
                              {val.value}
                              <button type="button" onClick={() => removeVariantValue(attr.id, val.id)} className="ml-0.5 hover:text-red-500">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex gap-2">
                        <Input
                          placeholder={`Add ${attr.name} value…`}
                          value={selectedAttributeId === attr.id ? newValueName : ""}
                          onFocus={() => setSelectedAttributeId(attr.id)}
                          onChange={(e) => setNewValueName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { setSelectedAttributeId(attr.id); addVariantValue(); } }}
                          className="h-8 text-sm"
                        />
                        {attr.name.toLowerCase().includes("color") && (
                          <input type="color" value={newValueHex} onChange={(e) => setNewValueHex(e.target.value)} className="h-8 w-10 rounded border" />
                        )}
                        <Button type="button" size="sm" onClick={() => { setSelectedAttributeId(attr.id); addVariantValue(); }}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    );
                  })}

                  {/* Combination selector — single flat table of all cartesian combos */}
                  {(() => {
                    // Build all cartesian combinations across ALL attributes
                    const getCombos = (attrs: VariantAttribute[]): string[][] => {
                      if (attrs.length === 0) return [[]];
                      const [first, ...rest] = attrs;
                      return first.values.flatMap((v) => getCombos(rest).map((c) => [v.id, ...c]));
                    };
                    const allCombos = getCombos(variantAttributes);
                    if (allCombos.length === 0 || allCombos[0].length === 0) return null;

                    const allSelected = allCombos.every((ids) => isVariantActive(ids));
                    const someSelected = allCombos.some((ids) => isVariantActive(ids));

                    const toggleAll = () => {
                      if (allSelected) {
                        // deselect all
                        allCombos.forEach((ids) => { if (isVariantActive(ids)) toggleVariant(ids); });
                      } else {
                        // select all
                        allCombos.forEach((ids) => { if (!isVariantActive(ids)) toggleVariant(ids); });
                      }
                    };

                    return (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Available Combinations — tick what you sell
                          </p>
                          <button
                            type="button"
                            onClick={toggleAll}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            {allSelected ? "Deselect All" : "Select All"}
                          </button>
                        </div>
                        <div className="rounded-lg border border-slate-200 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3 w-10">
                                  <span className={cn(
                                    "inline-flex h-5 w-5 items-center justify-center rounded border transition-all cursor-pointer",
                                    allSelected ? "border-primary bg-primary text-white" :
                                    someSelected ? "border-primary bg-primary/20 text-primary" :
                                    "border-slate-300 bg-white"
                                  )} onClick={toggleAll}>
                                    {(allSelected || someSelected) && <Check className="h-3 w-3" />}
                                  </span>
                                </th>
                                {variantAttributes.map((attr) => (
                                  <th key={attr.id} className="py-2.5 px-4 text-left text-xs font-semibold text-slate-500">
                                    {attr.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {allCombos.map((ids) => {
                                const active = isVariantActive(ids);
                                const label = ids.map((id) => {
                                  for (const attr of variantAttributes) {
                                    const v = attr.values.find((v) => v.id === id);
                                    if (v) return v;
                                  }
                                  return null;
                                });
                                return (
                                  <tr
                                    key={ids.join("-")}
                                    onClick={() => toggleVariant(ids)}
                                    className={cn(
                                      "cursor-pointer transition-colors",
                                      active ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-slate-50"
                                    )}
                                  >
                                    <td className="py-2.5 px-3">
                                      <span className={cn(
                                        "inline-flex h-5 w-5 items-center justify-center rounded border transition-all",
                                        active ? "border-primary bg-primary text-white" : "border-slate-300 bg-white"
                                      )}>
                                        {active && <Check className="h-3 w-3" />}
                                      </span>
                                    </td>
                                    {label.map((val, i) => (
                                      <td key={i} className="py-2.5 px-4 text-slate-700">
                                        <div className="flex items-center gap-2">
                                          {val?.hexCode && (
                                            <span className="h-4 w-4 rounded-full border border-slate-200 shrink-0" style={{ background: val.hexCode }} />
                                          )}
                                          <span className={active ? "font-medium" : ""}>{val?.value ?? "—"}</span>
                                        </div>
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })()}

          {/* Step 3 — Configure each selected variant */}
          {productVariants.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Step 3 — Configure Variants ({productVariants.length})
                </CardTitle>
                <p className="text-sm text-slate-500">Click a variant to set price, stock, images, and dimensions.</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {productVariants.map((variant) => {
                  // Look up the primary attribute value this variant belongs to
                  const primaryAttr = primaryAttributeId
                    ? variantAttributes.find((a) => a.id === primaryAttributeId)
                    : null;
                  const primaryVal = primaryAttr
                    ? primaryAttr.values.find((v) => variant.valueIds.includes(v.id))
                    : null;
                  const primImgs = primaryVal?.images && primaryVal.images.length > 0
                    ? primaryVal.images
                    : undefined;
                  return (
                    <VariantCard
                      key={variant.id}
                      variant={variant}
                      label={getVariantLabel(variant)}
                      onUpdate={(updates) => updateVariant(variant.id, updates)}
                      primaryImages={primImgs}
                      primaryLabel={primaryVal?.value}
                    />
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "variants" && !hasVariants && (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-2 font-medium text-slate-600">Enable Variants First</p>
            <p className="text-sm text-slate-500">
              Go to the Basic Info tab and enable "Product Variants" to configure options
            </p>
          </CardContent>
        </Card>
      )}

      {/* Shipping Tab */}
      {activeTab === "shipping" && (
        <div className="space-y-6">
          {hasVariants && productVariants.length > 0 ? (
            /* Variant product — dimensions live inside each VariantCard on the Variants tab */
            <Card>
              <CardContent className="py-10 text-center">
                <Ruler className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-2 font-medium text-slate-600">Dimensions are set per variant</p>
                <p className="text-sm text-slate-400 mt-1">
                  Open each variant card on the <strong>Variants</strong> tab to set its weight and dimensions.
                </p>
              </CardContent>
            </Card>
          ) : (
            /* Simple product — single set of dimensions */
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Product Dimensions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (kg)</Label>
                    <Input
                      id="weight" type="number" min="0" step="0.1"
                      value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0.0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="length">Length (cm)</Label>
                    <Input
                      id="length" type="number" min="0"
                      value={length} onChange={(e) => setLength(e.target.value)} placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="width">Width (cm)</Label>
                    <Input
                      id="width" type="number" min="0"
                      value={width} onChange={(e) => setWidth(e.target.value)} placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Height (cm)</Label>
                    <Input
                      id="height" type="number" min="0"
                      value={height} onChange={(e) => setHeight(e.target.value)} placeholder="0"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

