"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimFreePrize } from "@/lib/actions/raffle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MapPin, Truck, CheckCircle2, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";

interface ClaimModalProps {
  winner: {
    id: string;
    prize: {
      name: string;
      value: number;
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

export function RaffleClaimModal({
  winner,
  savedAddresses,
  isOpen,
  onClose,
}: ClaimModalProps) {
  const router = useRouter();
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    savedAddresses[0]?.id || "new"
  );
  const [loading, setLoading] = useState(false);

  // Form fields for new address
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    line1: "",
    line2: "",
    suburb: "",
    state: "NSW",
    postcode: "",
    country: "AU",
    saveToProfile: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let payload;
      if (selectedAddressId !== "new") {
        const addr = savedAddresses.find((a) => a.id === selectedAddressId);
        if (!addr) throw new Error("Selected address not found");
        payload = {
          winnerId: winner.id,
          name: addr.name,
          phone: addr.phone,
          line1: addr.line1,
          line2: addr.line2 || undefined,
          suburb: addr.suburb,
          state: addr.state,
          postcode: addr.postcode,
          country: addr.country || "AU",
          saveToProfile: false,
        };
      } else {
        payload = {
          winnerId: winner.id,
          ...formData,
        };
      }

      const res = await claimFreePrize(payload);
      if (res.success) {
        toast.success(res.message || "Prize claimed successfully!");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error || "Failed to claim prize.");
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
          <div className="flex items-center gap-2.5 text-emerald-600 mb-1">
            <Gift className="h-6 w-6" />
            <span className="text-xs font-black uppercase tracking-wider">
              100% Free Prize Claim
            </span>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black text-foreground">
            Claim Your Free Gift
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Congratulations on winning <strong className="text-foreground">{winner.prize.name}</strong> from{" "}
            <em>{winner.raffle.title}</em>! Enter your delivery address below so we can ship it to you.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {savedAddresses.length > 0 && (
            <div>
              <label className="text-xs font-bold text-foreground block mb-2">
                Select Delivery Address:
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
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

                <label
                  className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    selectedAddressId === "new"
                      ? "border-primary bg-primary/5 text-foreground shadow-xs"
                      : "border-border hover:bg-slate-50 text-muted-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    name="addressSelect"
                    value="new"
                    checked={selectedAddressId === "new"}
                    onChange={() => setSelectedAddressId("new")}
                    className="accent-primary"
                  />
                  <span className="text-xs font-bold">Use a different shipping address</span>
                </label>
              </div>
            </div>
          )}

          {/* New Address Fields */}
          {selectedAddressId === "new" && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Recipient Name"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Mobile number"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                  Street Address *
                </label>
                <input
                  type="text"
                  required
                  value={formData.line1}
                  onChange={(e) => setFormData({ ...formData, line1: e.target.value })}
                  placeholder="House / Unit # and Street name"
                  className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                    Suburb *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.suburb}
                    onChange={(e) => setFormData({ ...formData, suburb: e.target.value })}
                    placeholder="Suburb"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                    State *
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden"
                  >
                    <option value="NSW">NSW</option>
                    <option value="VIC">VIC</option>
                    <option value="QLD">QLD</option>
                    <option value="WA">WA</option>
                    <option value="SA">SA</option>
                    <option value="TAS">TAS</option>
                    <option value="ACT">ACT</option>
                    <option value="NT">NT</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">
                    Postcode *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                    placeholder="Postcode"
                    className="w-full text-xs px-3 py-2 rounded-xl border border-border bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-2.5 text-xs text-emerald-800">
            <Truck className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Complimentary standard shipping is included. No charges will apply.</span>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/95 shadow-md disabled:opacity-50 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting claim...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Confirm Delivery Address</span>
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

