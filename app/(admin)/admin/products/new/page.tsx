"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
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
import type { Category } from "@prisma/client";

interface VariantAttribute {
  id: string;
  name: string;
  displayOrder: number;
  values: { id: string; value: string; hexCode?: string }[];
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
          setVariantAttributes(p.variantAttributes.map((attr: any) => ({
            id: attr.id,
            name: attr.name,
            displayOrder: attr.displayOrder,
            values: (attr.variantValues || []).map((v: any) => ({
              id: v.id,
              value: v.value,
              hexCode: v.hexCode,
            })),
          })));
        }
        
        // Load product variants if present
        if (p.productVariants) {
          setProductVariants(p.productVariants.map((v: any) => ({
            id: v.id,
            sku: v.sku,
            price: v.price,
            comparePrice: v.comparePrice,
            memberPrice: v.memberPrice,
            stock: v.stock,
            isActive: v.isActive,
            valueIds: v.values?.map((val: any) => val.variantValueId) || [],
            images: v.images?.map((img: any) => img.url) || [],
            weight: v.weight,
            length: v.length,
            width: v.width,
            height: v.height,
          })));
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

  // Generate variants when attributes change
  useEffect(() => {
    if (!hasVariants || variantAttributes.length === 0) {
      setProductVariants([]);
      return;
    }

    // Get all combinations of variant values
    const getCombinations = (attrs: VariantAttribute[]): string[][] => {
      if (attrs.length === 0) return [[]];
      const [first, ...rest] = attrs;
      const restCombinations = getCombinations(rest);
      return first.values.flatMap((val) =>
        restCombinations.map((comb) => [val.id, ...comb])
      );
    };

    const combinations = getCombinations(variantAttributes);

    // Use functional update to access current variants without dependency
    setProductVariants((currentVariants) => {
      // Create/update product variants
      const newVariants: ProductVariant[] = combinations.map((valueIds) => {
        // Check if variant already exists
        const existing = currentVariants.find(
          (v) => JSON.stringify(v.valueIds.sort()) === JSON.stringify(valueIds.sort())
        );

        if (existing) {
          return existing;
        }

        // Generate SKU suffix from attribute values
        const suffix = valueIds
          .map((id) => {
            for (const attr of variantAttributes) {
              const val = attr.values.find((v) => v.id === id);
              if (val) return val.value.substring(0, 3).toUpperCase();
            }
            return "";
          })
          .join("-");

        // Create unique ID based on valueIds to avoid duplicate keys
        const uniqueId = valueIds.sort().join("-");

        // Generate variant SKU - ensure it's unique
        const timestamp = Date.now().toString(36).slice(-4).toUpperCase(); // Last 4 chars of timestamp in base36
        const variantSku = sku.trim() 
          ? `${sku}-${suffix}-${timestamp}`
          : `VAR-${suffix}-${timestamp}`;

        return {
          id: `var-${uniqueId}`,
          sku: variantSku,
          price: parseFloat(basePrice) || 0,
          stock: 0,
          isActive: true,
          valueIds,
          images: [],
        };
      });

      return newVariants;
    });
  }, [variantAttributes, hasVariants, sku, basePrice]);

  const addVariantAttribute = () => {
    if (!newAttributeName.trim()) return;
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
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_IMAGES_COUNT = 10;
  const MAX_NAME_LENGTH = 200;
  const MAX_DESCRIPTION_LENGTH = 5000;
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files);
    
    // Validate total image count
    if (images.length + fileArray.length > MAX_IMAGES_COUNT) {
      toast.error(`Maximum ${MAX_IMAGES_COUNT} images allowed`);
      return;
    }

    // Validate each file
    for (const file of fileArray) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error(`Invalid file type: ${file.name}. Only JPEG, PNG, WebP, GIF allowed.`);
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error(`File too large: ${file.name}. Maximum size is 5MB.`);
        return;
      }
    }

    // Convert files to base64 data URLs for preview
    const base64Promises = fileArray.map((file) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    try {
      const base64Images = await Promise.all(base64Promises);
      setImages((prev) => [...prev, ...base64Images]);
      toast.success(`${base64Images.length} image(s) uploaded`);
    } catch (error) {
      toast.error("Failed to load images");
    }
  };

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
    
    // Validate max image count in submit
    if (images.length > MAX_IMAGES_COUNT) {
      toast.error(`Maximum ${MAX_IMAGES_COUNT} images allowed`);
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
        variantAttributes: hasVariants
          ? variantAttributes.map((attr) => ({
              id: attr.id,
              name: attr.name,
              displayOrder: attr.displayOrder,
              values: attr.values.map((v) => ({
                id: v.id,
                value: v.value,
                hexCode: v.hexCode,
              })),
            }))
          : undefined,
        productVariants: hasVariants
          ? productVariants.map((v) => ({
              sku: v.sku,
              price: v.price,
              comparePrice: v.comparePrice,
              memberPrice: v.memberPrice,
              stock: v.stock,
              isActive: v.isActive,
              valueIds: v.valueIds, // These are the temp IDs
              images: v.images,
              weight: v.weight,
              length: v.length,
              width: v.width,
              height: v.height,
            }))
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
              <div className="flex flex-wrap gap-4">
                {images.map((img, i) => (
                  <div
                    key={i}
                    className="relative h-24 w-24 rounded-lg border border-slate-200 overflow-hidden group"
                  >
                    <img src={img} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 hover:border-primary hover:bg-slate-50 transition-colors">
                  <Upload className="h-6 w-6 text-slate-400" />
                  <span className="mt-1 text-xs text-slate-500">Add</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                First image will be used as the main product image
              </p>
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
          {/* Variant Attributes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Variant Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add new attribute */}
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

              {/* Attributes List */}
              <div className="space-y-4">
                {variantAttributes.map((attr) => (
                  <div
                    key={attr.id}
                    className={cn(
                      "rounded-lg border p-4",
                      selectedAttributeId === attr.id
                        ? "border-primary bg-primary/5"
                        : "border-slate-200"
                    )}
                    onClick={() => setSelectedAttributeId(attr.id)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{attr.name}</h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeVariantAttribute(attr.id);
                        }}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Values */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {attr.values.map((val) => (
                        <Badge
                          key={val.id}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {val.hexCode && (
                            <span
                              className="w-3 h-3 rounded-full border"
                              style={{ backgroundColor: val.hexCode }}
                            />
                          )}
                          {val.value}
                          <button
                            onClick={() => removeVariantValue(attr.id, val.id)}
                            className="ml-1 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>

                    {/* Add value */}
                    {selectedAttributeId === attr.id && (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Value name (e.g. Red, Large)"
                          value={newValueName}
                          onChange={(e) => setNewValueName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addVariantValue()}
                        />
                        {attr.name.toLowerCase().includes("color") && (
                          <input
                            type="color"
                            value={newValueHex}
                            onChange={(e) => setNewValueHex(e.target.value)}
                            className="h-10 w-10 rounded border"
                          />
                        )}
                        <Button onClick={addVariantValue} type="button" size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Product Variants Table */}
          {productVariants.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Variant Combinations ({productVariants.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="py-2 text-left text-xs font-medium text-slate-500">Variant</th>
                        <th className="py-2 text-left text-xs font-medium text-slate-500">SKU</th>
                        <th className="py-2 text-left text-xs font-medium text-slate-500">Price</th>
                        <th className="py-2 text-left text-xs font-medium text-slate-500">Stock</th>
                        <th className="py-2 text-left text-xs font-medium text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productVariants.map((variant) => (
                        <tr key={variant.id}>
                          <td className="py-2 text-slate-700">{getVariantLabel(variant)}</td>
                          <td className="py-2">
                            <Input
                              value={variant.sku}
                              onChange={(e) =>
                                updateVariant(variant.id, { sku: e.target.value })
                              }
                              className="w-32 h-8 text-xs"
                            />
                          </td>
                          <td className="py-2">
                            <Input
                              type="number"
                              value={variant.price}
                              onChange={(e) =>
                                updateVariant(variant.id, {
                                  price: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-24 h-8 text-xs"
                            />
                          </td>
                          <td className="py-2">
                            <Input
                              type="number"
                              value={variant.stock}
                              onFocus={(e) => {
                                if (variant.stock === 0) {
                                  e.target.select();
                                }
                              }}
                              onChange={(e) =>
                                updateVariant(variant.id, {
                                  stock: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-20 h-8 text-xs"
                            />
                          </td>
                          <td className="py-2">
                            <Switch
                              checked={variant.isActive}
                              onCheckedChange={(checked: boolean) =>
                                updateVariant(variant.id, { isActive: checked })
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
          {/* Check if there's a size variant attribute */}
          {(() => {
            const hasSizeVariant = variantAttributes.some(
              attr => attr.name.toLowerCase().includes('size') || attr.name.toLowerCase().includes('dimension')
            );
            const showVariantDimensions = hasVariants && productVariants.length > 0 && hasSizeVariant;
            const showCommonDimensions = !hasVariants || productVariants.length === 0 || !hasSizeVariant;

            return (
              <>
                {/* Common Dimensions - shown for simple products or when no size variant */}
                {showCommonDimensions && (
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
                            id="weight"
                            type="number"
                            min="0"
                            step="0.1"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            placeholder="0.0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="length">Length (cm)</Label>
                          <Input
                            id="length"
                            type="number"
                            min="0"
                            value={length}
                            onChange={(e) => setLength(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="width">Width (cm)</Label>
                          <Input
                            id="width"
                            type="number"
                            min="0"
                            value={width}
                            onChange={(e) => setWidth(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="height">Height (cm)</Label>
                          <Input
                            id="height"
                            type="number"
                            min="0"
                            value={height}
                            onChange={(e) => setHeight(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Variant-specific Dimensions - only when size variant exists */}
                {showVariantDimensions && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Ruler className="h-4 w-4" />
                        Variant Dimensions (by Size)
                      </CardTitle>
                      <p className="text-sm text-slate-500">
                        Set dimensions for each size variant
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="py-2 text-left text-xs font-medium text-slate-500">Variant</th>
                              <th className="py-2 text-left text-xs font-medium text-slate-500">Weight (kg)</th>
                              <th className="py-2 text-left text-xs font-medium text-slate-500">Length (cm)</th>
                              <th className="py-2 text-left text-xs font-medium text-slate-500">Width (cm)</th>
                              <th className="py-2 text-left text-xs font-medium text-slate-500">Height (cm)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {productVariants.map((variant) => (
                              <tr key={variant.id}>
                                <td className="py-2 text-slate-700 font-medium">{getVariantLabel(variant)}</td>
                                <td className="py-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={variant.weight || ""}
                                    onChange={(e) =>
                                      updateVariant(variant.id, {
                                        weight: e.target.value ? parseFloat(e.target.value) : undefined,
                                      })
                                    }
                                    className="w-24 h-8 text-xs"
                                    placeholder="0.0"
                                  />
                                </td>
                                <td className="py-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={variant.length || ""}
                                    onChange={(e) =>
                                      updateVariant(variant.id, {
                                        length: e.target.value ? parseFloat(e.target.value) : undefined,
                                      })
                                    }
                                    className="w-20 h-8 text-xs"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="py-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={variant.width || ""}
                                    onChange={(e) =>
                                      updateVariant(variant.id, {
                                        width: e.target.value ? parseFloat(e.target.value) : undefined,
                                      })
                                    }
                                    className="w-20 h-8 text-xs"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="py-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={variant.height || ""}
                                    onChange={(e) =>
                                      updateVariant(variant.id, {
                                        height: e.target.value ? parseFloat(e.target.value) : undefined,
                                      })
                                    }
                                    className="w-20 h-8 text-xs"
                                    placeholder="0"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

