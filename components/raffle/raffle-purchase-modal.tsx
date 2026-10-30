"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { prepareRafflePrizeForCheckout } from "@/lib/actions/raffle";
import { useCartStore } from "@/store/cart";
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
    setLoading(true);
    try {
      const res = await prepareRafflePrizeForCheckout(winner.id);
      if (res.success && res.cartItem) {
        useCartStore.getState().setRafflePrizeItem(res.cartItem);
        toast.success("Proceeding to checkout to complete purchase...");
        onClose();
        router.push(`/checkout?raffleWinnerId=${winner.id}`);
      } else {
        toast.error(res.error || "Failed to prepare prize checkout.");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 sm:p-7 bg-white border border-border shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-1.5 text-primary mb-1">
            <Sparkles className="h-4 w-4" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Exclusive Winner Privilege
            </span>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            Purchase Your Winning Prize
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            You won the exclusive pass to purchase <strong className="text-foreground">{winner.prize.name}</strong> at a special winner price!
          </DialogDescription>
        </DialogHeader>

        {/* Pricing Card */}
        <div className="mt-3 p-4 rounded-xl bg-secondary/50 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] text-muted-foreground uppercase font-semibold tracking-wider block">
                Exclusive Winner Price
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-primary">${price}</span>
                {originalValue > 0 && (
                  <span className="text-xs text-muted-foreground line-through">
                    RRP ${originalValue}
                  </span>
                )}
              </div>
            </div>

            {discountPct > 0 && (
              <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full border border-primary/20">
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
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    selectedAddressId === addr.id
                      ? "border-primary bg-primary/5 text-foreground shadow-xs"
                      : "border-border hover:bg-secondary/40 text-muted-foreground"
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
                    <p className="font-semibold text-foreground">
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

        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 rounded-full text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePurchase}
            disabled={loading || !selectedAddressId}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold bg-primary text-white hover:bg-primary/90 shadow-sm disabled:opacity-50 transition-colors"
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

