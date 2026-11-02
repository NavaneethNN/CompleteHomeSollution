"use client";

import { useState, useTransition } from "react";
import {
  Truck,
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  AlertCircle,
  MapPin,
  DollarSign,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  createManualDeliveryPostcode,
  updateManualDeliveryPostcode,
  deleteManualDeliveryPostcode,
} from "@/lib/actions/manual-delivery";

export interface ManualDeliveryPostcodeItem {
  id: string;
  postcode: string;
  suburb: string | null;
  charge: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ManualDeliveryClientProps {
  initialPostcodes: ManualDeliveryPostcodeItem[];
}

export function ManualDeliveryClient({ initialPostcodes }: ManualDeliveryClientProps) {
  const [postcodes, setPostcodes] = useState<ManualDeliveryPostcodeItem[]>(initialPostcodes);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Create / Edit modal state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ManualDeliveryPostcodeItem | null>(null);
  const [postcodeVal, setPostcodeVal] = useState("");
  const [suburbVal, setSuburbVal] = useState("");
  const [chargeVal, setChargeVal] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<ManualDeliveryPostcodeItem | null>(null);

  const openCreateDialog = () => {
    setEditingItem(null);
    setPostcodeVal("");
    setSuburbVal("");
    setChargeVal("");
    setDialogError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (item: ManualDeliveryPostcodeItem) => {
    setEditingItem(item);
    setPostcodeVal(item.postcode);
    setSuburbVal(item.suburb || "");
    setChargeVal(item.charge.toString());
    setDialogError(null);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    setDialogError(null);
    const cleanPostcode = postcodeVal.trim().replace(/\D/g, "").slice(0, 4);
    if (!/^\d{4}$/.test(cleanPostcode)) {
      setDialogError("Please enter a valid 4-digit Australian postcode.");
      return;
    }

    const numCharge = parseFloat(chargeVal);
    if (isNaN(numCharge) || numCharge < 0) {
      setDialogError("Please enter a valid delivery charge (0 or higher).");
      return;
    }

    startTransition(async () => {
      if (editingItem) {
        const res = await updateManualDeliveryPostcode(editingItem.id, {
          charge: numCharge,
          suburb: suburbVal.trim() || null,
        });

        if (!res.success) {
          setDialogError(res.error || "Failed to update postcode.");
          return;
        }

        setPostcodes((prev) =>
          prev.map((p) =>
            p.id === editingItem.id
              ? { ...p, charge: numCharge, suburb: suburbVal.trim() || null }
              : p
          )
        );
        toast({ title: "Updated", description: `Postcode ${editingItem.postcode} delivery charge updated.` });
        setIsDialogOpen(false);
      } else {
        const res = await createManualDeliveryPostcode({
          postcode: cleanPostcode,
          suburb: suburbVal.trim() || null,
          charge: numCharge,
        });

        if (!res.success) {
          setDialogError(res.error || "Failed to create postcode.");
          return;
        }

        setPostcodes((prev) => [...prev, res.postcode as any].sort((a, b) => a.postcode.localeCompare(b.postcode)));
        toast({ title: "Postcode Added", description: `Postcode ${cleanPostcode} added with $${numCharge.toFixed(2)} delivery charge.` });
        setIsDialogOpen(false);
      }
    });
  };

  const handleToggleActive = (item: ManualDeliveryPostcodeItem) => {
    const nextState = !item.isActive;
    startTransition(async () => {
      const res = await updateManualDeliveryPostcode(item.id, { isActive: nextState });
      if (res.success) {
        setPostcodes((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, isActive: nextState } : p))
        );
        toast({
          title: nextState ? "Postcode Enabled" : "Postcode Paused",
          description: `Postcode ${item.postcode} delivery is now ${nextState ? "active" : "disabled"}.`,
        });
      } else {
        toast({ title: "Action Blocked", description: res.error || "Could not update status", variant: "destructive" });
      }
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      const res = await deleteManualDeliveryPostcode(deleteTarget.id);
      if (res.success) {
        setPostcodes((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        toast({ title: "Deleted", description: `Postcode ${deleteTarget.postcode} removed.` });
        setDeleteTarget(null);
      } else {
        toast({ title: "Cannot Delete Postcode", description: res.error || "Failed to delete postcode", variant: "destructive" });
      }
    });
  };

  const filtered = postcodes.filter((p) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.postcode.includes(q) ||
      (p.suburb && p.suburb.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Informative Header / Guide */}
      <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
              <Truck className="h-6 w-6 text-primary" />
              Manual Postcode Delivery
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Configure postcodes where your store offers direct delivery for large or bulky items (such as sofas). 
              For postcodes entered below, customers will be offered direct manual delivery with your designated fixed charge. 
              Any postcode not listed here will automatically default to <strong>Store Pickup only</strong>.
            </p>
          </div>
          <Button onClick={openCreateDialog} className="shrink-0 gap-2">
            <Plus className="h-4 w-4" />
            Add Delivery Postcode
          </Button>
        </div>

        {/* Quick Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-border">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {postcodes.filter((p) => p.isActive).length}
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Active Postcodes</p>
              <p className="text-sm font-bold text-foreground">Covered Areas</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm">
              Free
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Store Pickup</p>
              <p className="text-sm font-bold text-foreground">Always Available</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-sm">
              Auto
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Unlisted Postcodes</p>
              <p className="text-sm font-bold text-foreground">Pickup Only for Sofas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by postcode or suburb..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
      </div>

      {/* Postcodes Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3.5 font-semibold">Postcode</th>
                <th className="px-6 py-3.5 font-semibold">Suburb / Locality</th>
                <th className="px-6 py-3.5 font-semibold">Delivery Charge</th>
                <th className="px-6 py-3.5 font-semibold text-center">Active</th>
                <th className="px-6 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    <Truck className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-foreground">No delivery postcodes configured yet</p>
                    <p className="text-xs mt-1">
                      {searchQuery
                        ? "No postcodes matched your search."
                        : "Click 'Add Delivery Postcode' above to add postcodes where your team provides local delivery."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-base text-foreground">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {item.postcode}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground font-medium">
                      {item.suburb || <span className="text-muted-foreground italic">Entire postcode</span>}
                    </td>
                    <td className="px-6 py-4 font-bold text-emerald-700">
                      ${item.charge.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Switch
                        checked={item.isActive}
                        onCheckedChange={() => handleToggleActive(item)}
                        disabled={isPending}
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                          className="h-8 w-8 p-0"
                          title="Edit Charge"
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(item)}
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                          title="Delete Postcode"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? `Edit Delivery Postcode ${editingItem.postcode}` : "Add Delivery Postcode"}
            </DialogTitle>
            <DialogDescription>
              Set the fixed charge for manual large item / sofa deliveries to this postal area.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {dialogError && (
              <div className="p-3 text-xs rounded-lg bg-destructive/10 text-destructive font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {dialogError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="postcode">4-Digit Postcode</Label>
              <Input
                id="postcode"
                placeholder="e.g. 5125, 3000"
                maxLength={4}
                value={postcodeVal}
                onChange={(e) => setPostcodeVal(e.target.value.replace(/\D/g, "").slice(0, 4))}
                disabled={!!editingItem}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="suburb">Suburb / Locality (Optional)</Label>
              <Input
                id="suburb"
                placeholder="e.g. Golden Grove, Salisbury, CBD"
                value={suburbVal}
                onChange={(e) => setSuburbVal(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="charge">Fixed Delivery Charge (AUD $)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                  $
                </span>
                <Input
                  id="charge"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 50.00"
                  className="pl-8"
                  value={chargeVal}
                  onChange={(e) => setChargeVal(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Customers checking out with large items to this postcode will be charged this fixed fee for delivery.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingItem ? "Update Charge" : "Add Postcode"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Remove Delivery Postcode
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove postcode <strong>{deleteTarget?.postcode}</strong>? Large items ordered to this postcode will no longer be eligible for direct delivery and will require Store Pickup.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

