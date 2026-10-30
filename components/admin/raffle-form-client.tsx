"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Ticket,
  Plus,
  Trash2,
  Gift,
  Trophy,
  Calendar,
  Save,
  ArrowLeft,
  Loader2,
  Sparkles,
  Crown,
  HelpCircle,
} from "lucide-react";
import { createRaffle, updateRaffle } from "@/lib/actions/admin-raffle";
import { RaffleFormData, RafflePrizeFormData } from "@/lib/validations/raffle";
import { toast } from "sonner";
import slugify from "slugify";

interface RaffleFormProps {
  initialData?: any;
  availableProducts?: Array<{
    id: string;
    name: string;
    basePrice: number;
    images: string[];
  }>;
}

export function RaffleFormClient({ initialData, availableProducts = [] }: RaffleFormProps) {
  const router = useRouter();
  const isEditing = !!initialData?.id;

  const now = new Date();
  const defaultStart = new Date(now.getTime() + 1000 * 60 * 5).toISOString().slice(0, 16);
  const defaultEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 16);
  const defaultDraw = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 15).toISOString().slice(0, 16);

  const [formData, setFormData] = useState<RaffleFormData>({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    shortDescription: initialData?.shortDescription || "",
    description: initialData?.description || "",
    bannerImage: initialData?.bannerImage || "",
    images: initialData?.images || [],
    status: initialData?.status || "ACTIVE",
    entryPrice: initialData?.entryPrice || 0,
    isPaid: initialData?.isPaid || false,
    visibility: initialData?.visibility || "ALL",
    eligiblePlanIds: initialData?.eligiblePlanIds || [],
    maxEntriesPerUser: initialData?.maxEntriesPerUser || 1,
    minEntriesPerUser: initialData?.minEntriesPerUser || 1,
    totalMaxEntries: initialData?.totalMaxEntries || null,
    allowMultipleEntries: initialData?.allowMultipleEntries || false,
    startDate: initialData?.startDate ? new Date(initialData.startDate).toISOString().slice(0, 16) : defaultStart,
    endDate: initialData?.endDate ? new Date(initialData.endDate).toISOString().slice(0, 16) : defaultEnd,
    drawDate: initialData?.drawDate ? new Date(initialData.drawDate).toISOString().slice(0, 16) : defaultDraw,
    automaticClosure: initialData?.automaticClosure ?? true,
    terms: initialData?.terms || "1. Free promotional draw open to Australian residents aged 18+. 2. Multiple entries permitted up to the maximum entry limit. 3. Free prizes include complimentary home delivery.",
    ageRestriction: initialData?.ageRestriction || 18,
    geographicRestriction: initialData?.geographicRestriction || "Australia",
    isFeatured: initialData?.isFeatured || false,
    displayOnHomepage: initialData?.displayOnHomepage ?? true,
    prizes: initialData?.prizes?.length
      ? initialData.prizes.map((p: any) => ({
          rank: p.rank,
          name: p.name,
          description: p.description || "",
          images: p.images || [],
          value: p.value || 0,
          prizeType: p.prizeType || "FREE_PRODUCT",
          price: p.price || 0,
          quantity: p.quantity || 1,
          productId: p.productId || null,
          productVariantId: p.productVariantId || null,
        }))
      : [
          {
            rank: 1,
            name: "Grand Prize: Luxury Home Item",
            description: "100% Free winner prize with free delivery to winner's address.",
            images: [],
            value: 899,
            prizeType: "FREE_PRODUCT",
            price: 0,
            quantity: 1,
            productId: null,
            productVariantId: null,
          },
        ],
  });

  const [loading, setLoading] = useState(false);

  const handleTitleChange = (val: string) => {
    setFormData((prev) => ({
      ...prev,
      title: val,
      slug: !isEditing ? slugify(val, { lower: true, strict: true }) : prev.slug,
    }));
  };

  const handleAddPrize = () => {
    const nextRank = formData.prizes.length + 1;
    setFormData((prev) => ({
      ...prev,
      prizes: [
        ...prev.prizes,
        {
          rank: nextRank,
          name: `Tier ${nextRank} Prize`,
          description: "Exclusive winner prize",
          images: [],
          value: 299,
          prizeType: "FREE_PRODUCT",
          price: 0,
          quantity: 1,
          productId: null,
          productVariantId: null,
        },
      ],
    }));
  };

  const handleRemovePrize = (index: number) => {
    if (formData.prizes.length <= 1) {
      toast.error("At least one prize tier is required.");
      return;
    }
    setFormData((prev) => {
      const updated = prev.prizes.filter((_, idx) => idx !== index);
      // Re-rank prizes sequentially
      return {
        ...prev,
        prizes: updated.map((p, idx) => ({ ...p, rank: idx + 1 })),
      };
    });
  };

  const handlePrizeChange = (index: number, field: keyof RafflePrizeFormData, value: any) => {
    setFormData((prev) => {
      const updated = [...prev.prizes];
      updated[index] = { ...updated[index], [field]: value };

      // If linking a catalog product, autofill name & value if empty
      if (field === "productId" && value) {
        const prod = availableProducts.find((p) => p.id === value);
        if (prod) {
          if (!updated[index].name || updated[index].name.startsWith("Tier")) {
            updated[index].name = prod.name;
          }
          if (!updated[index].value || updated[index].value === 0) {
            updated[index].value = prod.basePrice;
          }
          if (prod.images?.length && (!updated[index].images || !updated[index].images.length)) {
            updated[index].images = [prod.images[0]];
          }
        }
      }

      return { ...prev, prizes: updated };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditing) {
        const res = await updateRaffle(initialData.id, formData);
        if (res.success) {
          toast.success(res.message);
          router.push(`/admin/raffles/${initialData.id}`);
          router.refresh();
        } else {
          toast.error(res.error || "Failed to update raffle");
        }
      } else {
        const res = await createRaffle(formData);
        if (res.success) {
          toast.success(res.message);
          router.push(`/admin/raffles/${res.raffleId}`);
          router.refresh();
        } else {
          toast.error(res.error || "Failed to create raffle");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-16">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/raffles"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Raffles</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            {isEditing ? `Edit Raffle: ${formData.title}` : "Create New Raffle Campaign"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure multi-tier prizes (free gifts or discounted items), participation rules, and draw timelines.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/raffles"
            className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-slate-100 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-xs shadow-md hover:bg-primary/95 disabled:opacity-50 transition-all hover:scale-[1.01]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving Campaign...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>{isEditing ? "Save Changes" : "Publish Raffle"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 1. Basic Campaign Information ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-4">
        <h2 className="text-lg font-black text-foreground flex items-center gap-2 pb-3 border-b border-border">
          <Ticket className="h-5 w-5 text-primary" />
          1. Campaign Details
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Raffle Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Grand Spring Home Luxury Giveaway"
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              URL Slug *
            </label>
            <input
              type="text"
              required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="e.g. grand-spring-giveaway"
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden font-mono"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-foreground block mb-1">
            Short Tagline / Teaser
          </label>
          <input
            type="text"
            value={formData.shortDescription || ""}
            onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
            placeholder="e.g. Win a handcrafted King Platform Bed for free or unlock special $79 executive chairs!"
            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-foreground block mb-1">
            Detailed Description *
          </label>
          <textarea
            required
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the raffle, celebration event, why customers should participate..."
            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Banner Image URL
            </label>
            <input
              type="url"
              value={formData.bannerImage || ""}
              onChange={(e) => setFormData({ ...formData, bannerImage: e.target.value })}
              placeholder="https://..."
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Initial Campaign Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden font-bold"
            >
              <option value="ACTIVE">ACTIVE (Open for entries immediately)</option>
              <option value="UPCOMING">UPCOMING (Visible, opens at start date)</option>
              <option value="DRAFT">DRAFT (Hidden from store)</option>
              <option value="PAUSED">PAUSED</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── 2. Multi-Tier Prizes Configuration ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
          <div>
            <h2 className="text-lg font-black text-foreground flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              2. Multi-Tier Prizes & Freebies ({formData.prizes.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add multiple winning tiers: 100% Free Products (customer submits shipping address) or Paid Products (customer purchases at special winning rate).
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddPrize}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors self-start sm:self-auto shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Prize Tier</span>
          </button>
        </div>

        <div className="space-y-4">
          {formData.prizes.map((prize, idx) => {
            const isFree = prize.prizeType === "FREE_PRODUCT";
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 relative"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-slate-900 bg-white px-3 py-1 rounded-full border border-slate-200">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[10px]">
                      {prize.rank}
                    </span>
                    Prize Tier #{prize.rank}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemovePrize(idx)}
                    disabled={formData.prizes.length <= 1}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30"
                    title="Remove Tier"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                      Prize Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={prize.name}
                      onChange={(e) => handlePrizeChange(idx, "name", e.target.value)}
                      placeholder="e.g. King Size Platform Bed or Ergonomic Office Chair"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-white focus:outline-hidden focus:ring-2 focus:ring-primary/20 font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                      Link Catalogue Product (Optional)
                    </label>
                    <select
                      value={prize.productId || ""}
                      onChange={(e) => handlePrizeChange(idx, "productId", e.target.value || null)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-white focus:outline-hidden"
                    >
                      <option value="">-- None (Custom Prize) --</option>
                      {availableProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (${p.basePrice})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                      Prize Type *
                    </label>
                    <select
                      value={prize.prizeType}
                      onChange={(e) => handlePrizeChange(idx, "prizeType", e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-white focus:outline-hidden font-bold"
                    >
                      <option value="FREE_PRODUCT">100% Free Product</option>
                      <option value="PAID_PRODUCT">Special Paid Rate</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                      {isFree ? "Winning Price" : "Winner Purchase Price ($) *"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      disabled={isFree}
                      value={isFree ? 0 : prize.price}
                      onChange={(e) => handlePrizeChange(idx, "price", parseFloat(e.target.value) || 0)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-white focus:outline-hidden font-bold disabled:bg-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                      Market Value ($) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={prize.value}
                      onChange={(e) => handlePrizeChange(idx, "value", parseFloat(e.target.value) || 0)}
                      placeholder="e.g. 899"
                      className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-white focus:outline-hidden font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                      Winners for this Tier *
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={prize.quantity}
                      onChange={(e) => handlePrizeChange(idx, "quantity", parseInt(e.target.value) || 1)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-white focus:outline-hidden font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                      Short Prize Description
                    </label>
                    <input
                      type="text"
                      value={prize.description || ""}
                      onChange={(e) => handlePrizeChange(idx, "description", e.target.value)}
                      placeholder="e.g. Solid timber platform with upholstered headboard."
                      className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-white focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                      Prize Image URL
                    </label>
                    <input
                      type="url"
                      value={prize.images?.[0] || ""}
                      onChange={(e) =>
                        handlePrizeChange(idx, "images", e.target.value ? [e.target.value] : [])
                      }
                      placeholder="https://images.unsplash.com/..."
                      className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-white focus:outline-hidden font-mono"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. Participation & Eligibility Settings ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-4">
        <h2 className="text-lg font-black text-foreground flex items-center gap-2 pb-3 border-b border-border">
          <Crown className="h-5 w-5 text-amber-500" />
          3. Participation & Visibility Settings
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Audience Visibility
            </label>
            <select
              value={formData.visibility}
              onChange={(e) => setFormData({ ...formData, visibility: e.target.value as any })}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden font-bold"
            >
              <option value="ALL">Everyone (Open to all customers)</option>
              <option value="MEMBERS_ONLY">VIP Members Only</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Max Entries Per Customer
            </label>
            <input
              type="number"
              min={1}
              value={formData.maxEntriesPerUser}
              onChange={(e) => setFormData({ ...formData, maxEntriesPerUser: parseInt(e.target.value) || 1 })}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Total Max Entries (Optional Cap)
            </label>
            <input
              type="number"
              min={1}
              value={formData.totalMaxEntries || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  totalMaxEntries: e.target.value ? parseInt(e.target.value) : null,
                })
              }
              placeholder="Leave blank for unlimited"
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden font-bold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.allowMultipleEntries}
              onChange={(e) => setFormData({ ...formData, allowMultipleEntries: e.target.checked })}
              className="w-4 h-4 rounded text-primary accent-primary"
            />
            <div>
              <span className="text-xs font-bold text-foreground block">
                Allow Multiple Entries Per Customer
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Allows customers to claim more than 1 ticket up to the max entry limit.
              </span>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.displayOnHomepage}
              onChange={(e) => setFormData({ ...formData, displayOnHomepage: e.target.checked })}
              className="w-4 h-4 rounded text-primary accent-primary"
            />
            <div>
              <span className="text-xs font-bold text-foreground block">
                Display on Store Homepage
              </span>
              <span className="text-[11px] text-muted-foreground block">
                Feature in the homepage giveaways showcase.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* ── 4. Schedule & Draw Dates ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-border shadow-xs space-y-4">
        <h2 className="text-lg font-black text-foreground flex items-center gap-2 pb-3 border-b border-border">
          <Calendar className="h-5 w-5 text-primary" />
          4. Campaign Schedule & Draw Date
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Start Date & Time *
            </label>
            <input
              type="datetime-local"
              required
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Entry Closing Date & Time *
            </label>
            <input
              type="datetime-local"
              required
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1">
              Official Draw Date & Time *
            </label>
            <input
              type="datetime-local"
              required
              value={formData.drawDate}
              onChange={(e) => setFormData({ ...formData, drawDate: e.target.value })}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden font-bold"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-foreground block mb-1">
            Terms & Conditions
          </label>
          <textarea
            rows={3}
            value={formData.terms || ""}
            onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
            className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden leading-relaxed"
          />
        </div>
      </div>

      {/* ── Submit Button Strip ── */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Link
          href="/admin/raffles"
          className="px-5 py-3 rounded-2xl border border-border text-xs font-bold text-muted-foreground hover:bg-slate-100 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-primary text-white font-black text-sm shadow-lg hover:bg-primary/95 disabled:opacity-50 transition-all hover:scale-[1.01]"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving Campaign...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>{isEditing ? "Update Raffle" : "Create & Launch Raffle"}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
