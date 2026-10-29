"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import {
  createPromotion,
  updatePromotion,
  deletePromotion,
  togglePromotionActive,
  type PromotionBannerItem,
  type PromotionInput,
} from "@/lib/actions/promotions";

interface PromotionsClientProps {
  initialPromotions: PromotionBannerItem[];
}

export function PromotionsClient({ initialPromotions }: PromotionsClientProps) {
  const [promotions, setPromotions] = useState<PromotionBannerItem[]>(initialPromotions);
  const [isPending, startTransition] = useTransition();

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromotionBannerItem | null>(null);

  // Delete dialog state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("/products");
  const [linkText, setLinkText] = useState("Shop Now");
  const [popupImages, setPopupImages] = useState<string[]>([]);
  const [bannerImages, setBannerImages] = useState<string[]>([]);
  const [showInPopup, setShowInPopup] = useState(true);
  const [showInBanner, setShowInBanner] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);

  const openCreateDialog = () => {
    setEditingPromo(null);
    setTitle("");
    setSubtitle("");
    setLinkUrl("/products");
    setLinkText("Shop Now");
    setPopupImages([]);
    setBannerImages([]);
    setShowInPopup(true);
    setShowInBanner(true);
    setIsActive(true);
    setDisplayOrder(promotions.length);
    setIsDialogOpen(true);
  };

  const openEditDialog = (promo: PromotionBannerItem) => {
    setEditingPromo(promo);
    setTitle(promo.title);
    setSubtitle(promo.subtitle || "");
    setLinkUrl(promo.linkUrl || "/products");
    setLinkText(promo.linkText || "Shop Now");
    setPopupImages(promo.popupImage ? [promo.popupImage] : []);
    setBannerImages(promo.bannerImage ? [promo.bannerImage] : []);
    setShowInPopup(promo.showInPopup);
    setShowInBanner(promo.showInBanner);
    setIsActive(promo.isActive);
    setDisplayOrder(promo.displayOrder);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!title.trim()) {
      toast.error("Please enter a poster title");
      return;
    }

    const popupImage = popupImages[0] || null;
    const bannerImage = bannerImages[0] || null;

    if (!popupImage && !bannerImage) {
      toast.error("Please upload at least a square pop-up poster or a wide banner image");
      return;
    }

    const payload: PromotionInput = {
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      linkUrl: linkUrl.trim() || "/products",
      linkText: linkText.trim() || "Shop Now",
      popupImage,
      bannerImage,
      showInPopup,
      showInBanner,
      isActive,
      displayOrder: Number(displayOrder) || 0,
    };

    startTransition(async () => {
      try {
        if (editingPromo) {
          const res = await updatePromotion(editingPromo.id, payload);
          if (res.success) {
            setPromotions((prev) =>
              prev.map((p) => (p.id === editingPromo.id ? (res.data as PromotionBannerItem) : p))
            );
            toast.success("Promotional poster updated successfully");
            setIsDialogOpen(false);
          }
        } else {
          const res = await createPromotion(payload);
          if (res.success) {
            setPromotions((prev) => [...prev, res.data as PromotionBannerItem]);
            toast.success("New promotional poster added successfully");
            setIsDialogOpen(false);
          }
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to save promotional poster");
      }
    });
  };

  const handleToggleActive = (id: string, currentActive: boolean) => {
    startTransition(async () => {
      try {
        const nextActive = !currentActive;
        await togglePromotionActive(id, nextActive);
        setPromotions((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive: nextActive } : p))
        );
        toast.success(nextActive ? "Poster activated" : "Poster deactivated");
      } catch (err: any) {
        toast.error(err.message || "Failed to update status");
      }
    });
  };

  const handleDelete = () => {
    if (!deletingId) return;
    startTransition(async () => {
      try {
        await deletePromotion(deletingId);
        setPromotions((prev) => prev.filter((p) => p.id !== deletingId));
        toast.success("Poster deleted successfully");
        setDeletingId(null);
      } catch (err: any) {
        toast.error(err.message || "Failed to delete poster");
      }
    });
  };

  const activeCount = promotions.filter((p) => p.isActive).length;
  const popupCount = promotions.filter((p) => p.isActive && p.showInPopup && p.popupImage).length;
  const bannerCount = promotions.filter((p) => p.isActive && p.showInBanner && p.bannerImage).length;

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">Posters & Promotional Banners</h1>
            <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5">
              {promotions.length} Total
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage homepage pop-up offer posters and wide banner carousels for the home hero and /products page.
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {activeCount} Active Live
            </span>
            <span>•</span>
            <span>{popupCount} in Home Pop-up</span>
            <span>•</span>
            <span>{bannerCount} in Banner Carousel</span>
          </div>
        </div>

        <Button onClick={openCreateDialog} className="shrink-0 gap-2 bg-primary hover:bg-primary/90 text-white font-semibold">
          <Plus className="w-4 h-4" /> Add Offer Poster
        </Button>
      </div>

      {/* Zero State */}
      {promotions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <Megaphone className="w-7 h-7" />
          </div>
          <h2 className="text-base font-bold text-foreground mb-1">No promotional posters yet</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Upload your first offer poster! You can add square posters for the homepage pop-up and wide LinkedIn-size banners for the home and products carousel.
          </p>
          <Button onClick={openCreateDialog} className="gap-2 bg-primary hover:bg-primary/90 text-white">
            <Plus className="w-4 h-4" /> Upload First Poster
          </Button>
        </div>
      ) : (
        /* Posters Grid / List */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {promotions.map((promo) => (
            <div
              key={promo.id}
              className={`bg-white rounded-2xl border transition-all overflow-hidden shadow-xs ${
                promo.isActive ? "border-border" : "border-border/60 opacity-75"
              }`}
            >
              {/* Media Preview Section */}
              <div className="p-4 bg-secondary/30 border-b border-border/60 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Display Previews</span>
                  <div className="flex items-center gap-2">
                    {promo.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                        <Eye className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        <EyeOff className="w-3 h-3" /> Inactive
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  {/* Square Popup Preview */}
                  <div className="sm:col-span-4 flex flex-col items-center">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
                      Pop-up Poster (1:1)
                    </span>
                    <div className="relative aspect-square w-28 rounded-xl overflow-hidden bg-secondary border border-border shadow-xs flex items-center justify-center">
                      {promo.popupImage ? (
                        <Image
                          src={promo.popupImage}
                          alt={promo.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="p-2 text-center text-[10px] text-muted-foreground flex flex-col items-center">
                          <ImageIcon className="w-5 h-5 opacity-40 mb-1" />
                          <span>Not set</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Wide Banner Preview */}
                  <div className="sm:col-span-8 flex flex-col items-center sm:items-start">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
                      Banner Carousel (~4:1)
                    </span>
                    <div className="relative aspect-[4/1] w-full rounded-xl overflow-hidden bg-secondary border border-border shadow-xs flex items-center justify-center">
                      {promo.bannerImage ? (
                        <Image
                          src={promo.bannerImage}
                          alt={promo.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="p-2 text-center text-[10px] text-muted-foreground flex flex-col items-center">
                          <ImageIcon className="w-5 h-5 opacity-40 mb-1" />
                          <span>Not set</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Poster Details */}
              <div className="p-5 space-y-4">
                <div>
                  <h3 className="font-bold text-base text-foreground leading-snug">{promo.title}</h3>
                  {promo.subtitle && (
                    <p className="text-xs text-muted-foreground mt-0.5">{promo.subtitle}</p>
                  )}
                  {promo.linkUrl && (
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium mt-2">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span className="truncate">{promo.linkUrl}</span>
                    </div>
                  )}
                </div>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {promo.showInPopup && promo.popupImage && (
                    <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 text-[11px]">
                      Home Pop-up Ad
                    </Badge>
                  )}
                  {promo.showInBanner && promo.bannerImage && (
                    <Badge variant="outline" className="text-purple-700 bg-purple-50 border-purple-200 text-[11px]">
                      Banner Carousel
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    Order: <strong className="text-foreground">{promo.displayOrder}</strong>
                  </span>
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={promo.isActive}
                      onCheckedChange={() => handleToggleActive(promo.id, promo.isActive)}
                      aria-label="Toggle active status"
                    />
                    <span className="text-xs font-medium text-foreground">
                      {promo.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(promo)}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingId(promo.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPromo ? "Edit Promotional Poster" : "Add Promotional Poster"}
            </DialogTitle>
            <DialogDescription>
              Upload square offer posters for the homepage pop-up and wide LinkedIn-size banners for the homepage hero & products page.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-3">
            {/* Title */}
            <div>
              <Label htmlFor="promo-title" className="text-xs font-bold text-foreground">
                Poster / Offer Title *
              </Label>
              <Input
                id="promo-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Exclusive Weekend Sale — Save 20%"
                className="mt-1.5"
              />
            </div>

            {/* Subtitle */}
            <div>
              <Label htmlFor="promo-subtitle" className="text-xs font-bold text-foreground">
                Subtitle / Description (Optional)
              </Label>
              <Input
                id="promo-subtitle"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="e.g. Use code SPRING20 at checkout"
                className="mt-1.5"
              />
            </div>

            {/* Link URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="promo-link" className="text-xs font-bold text-foreground">
                  Destination URL
                </Label>
                <Input
                  id="promo-link"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="/products or /categories/living-room"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="promo-link-text" className="text-xs font-bold text-foreground">
                  Button Text (Pop-up CTA)
                </Label>
                <Input
                  id="promo-link-text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Shop Now"
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* 1. Square Pop-up Poster */}
            <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-foreground">
                    1. Square Poster (1:1 Ratio) — Home Pop-up Ad
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Displayed inside the popup placeholder when customers open the website.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">Show in Pop-up</span>
                  <Switch
                    checked={showInPopup}
                    onCheckedChange={setShowInPopup}
                    aria-label="Toggle show in pop-up"
                  />
                </div>
              </div>

              <ImageUploader
                images={popupImages}
                onChange={setPopupImages}
                maxImages={1}
                folder="promotions"
                compact
              />
            </div>

            {/* 2. Wide LinkedIn-size Banner */}
            <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold text-foreground">
                    2. Wide Banner (~4:1 Ratio) — Carousel Banner
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    LinkedIn banner proportions (~1200×300 or 1584×396). Displayed below the Home hero and on /products.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">Show in Carousel</span>
                  <Switch
                    checked={showInBanner}
                    onCheckedChange={setShowInBanner}
                    aria-label="Toggle show in banner"
                  />
                </div>
              </div>

              <ImageUploader
                images={bannerImages}
                onChange={setBannerImages}
                maxImages={1}
                folder="promotions"
                compact
              />
            </div>

            {/* Settings Row */}
            <div className="grid grid-cols-2 gap-4 items-center pt-2">
              <div>
                <Label htmlFor="promo-order" className="text-xs font-bold text-foreground">
                  Display Order
                </Label>
                <Input
                  id="promo-order"
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                  className="mt-1.5"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-4">
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  id="promo-active-toggle"
                />
                <Label htmlFor="promo-active-toggle" className="text-xs font-bold cursor-pointer">
                  Active (Visible to customers)
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending}
              className="bg-primary hover:bg-primary/90 text-white font-semibold gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingPromo ? "Save Changes" : "Create Poster"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Promotional Poster?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this poster from the homepage popup ad and banner carousels. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isPending ? "Deleting..." : "Delete Poster"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
