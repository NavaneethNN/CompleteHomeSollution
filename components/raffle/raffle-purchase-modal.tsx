"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { purchasePaidPrize } from "@/lib/actions/raffle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ShoppingBag, CheckCircle2, Loader2, Sparkles, Tag } from "lucide-react";
import { toast } from "sonner";

interface PurchaseModalProps {
  winner: {
    id: string;
    winningPrice: number;
    prize: {
      name: string;
      value: number;
      price: number;
    };
    raffle: {
      title: string;
    };
  };
  savedAddresses: Array<{
    id: string;
    name: string;
    phone: string;
    line1: string;
    line2?: string | null;
    suburb: string;
    state: string;
    postcode: string;
    country: string;
  }>;
  isOpen: boolean;
  onClose: () => void;
}

export function RafflePurchaseModal({
  winner,
  savedAddresses,
  isOpen,
  onClose,
}: PurchaseModalProps) {
  const router = useRouter();
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    savedAddresses[0]?.id || ""
  );
  const [loading, setLoading] = useState(false);

  const price = winner.winningPrice || winner.prize.price || 0;
  const originalValue = winner.prize.value || 0;
  const discountAmount = Math.max(0, originalValue - price);
  const discountPct = originalValue > 0 ? Math.round((discountAmount / originalValue) * 100) : 0;

  const handlePurchase = async () => {
    if (!selectedAddressId) {
      toast.error("Please select a delivery address.");
      return;
    }

    setLoading(true);
    try {
      const res = await purchasePaidPrize(winner.id, selectedAddressId);
      if (res.success) {
        toast.success(res.message || "Winning prize purchase confirmed!");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error || "Failed to purchase prize.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-wider">
              Exclusive Winner Privilege
            </span>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black text-foreground">
            Purchase Your Winning Prize
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            You won the exclusive pass to purchase <strong className="text-foreground">{winner.prize.name}</strong> at a special winner price!
          </DialogDescription>
        </DialogHeader>

        {/* Pricing Card */}
        <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider block">
                Exclusive Winner Price
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-primary">${price}</span>
                {originalValue > 0 && (
                  <span className="text-xs text-muted-foreground line-through">
                    RRP ${originalValue}
                  </span>
                )}
              </div>
            </div>

            {discountPct > 0 && (
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-black px-2.5 py-1 rounded-full border border-emerald-200">
                <Tag className="h-3.5 w-3.5" />
                Save {discountPct}% (${discountAmount})
              </span>
            )}
          </div>
        </div>

        {/* Delivery Address Selection */}
        <div className="mt-4">
          <label className="text-xs font-bold text-foreground block mb-2">
            Select Delivery Address:
          </label>
          {savedAddresses.length > 0 ? (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {savedAddresses.map((addr) => (
                <label
                  key={addr.id}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    selectedAddressId === addr.id
                      ? "border-primary bg-primary/5 text-foreground shadow-xs"
                      : "border-border hover:bg-slate-50 text-muted-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    name="addressSelect"
                    value={addr.id}
                    checked={selectedAddressId === addr.id}
                    onChange={() => setSelectedAddressId(addr.id)}
                    className="mt-1 accent-primary"
                  />
                  <div className="text-xs leading-relaxed">
                    <p className="font-bold text-foreground">
                      {addr.name} ({addr.phone})
                    </p>
                    <p>
                      {addr.line1}
                      {addr.line2 ? `, ${addr.line2}` : ""}, {addr.suburb} {addr.state} {addr.postcode}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
              No saved addresses found. Please add an address in your Profile or Checkout.
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePurchase}
            disabled={loading || !selectedAddressId}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/95 shadow-md disabled:opacity-50 transition-all hover:scale-[1.01]"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Confirming Order...</span>
              </>
            ) : (
              <>
                <ShoppingBag className="h-4 w-4" />
                <span>Confirm Purchase (${price})</span>
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

