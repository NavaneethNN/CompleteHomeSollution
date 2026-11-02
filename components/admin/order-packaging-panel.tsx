"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Box,
  Scale,
  Maximize2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  RotateCcw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { updateOrderPackaging } from "@/lib/actions/packaging";
import type { PackagingPresetType } from "@/lib/packaging";

interface OrderPackagingPanelProps {
  orderId: string;
  initialPackagePresetId?: string | null;
  initialPackageName?: string | null;
  initialPackedLength?: number | null;
  initialPackedWidth?: number | null;
  initialPackedHeight?: number | null;
  initialPackedWeight?: number | null;
  initialPackageOverride?: boolean | null;
  calculatedProductWeight: number;
  availablePresets: PackagingPresetType[];
}

export function OrderPackagingPanel({
  orderId,
  initialPackagePresetId,
  initialPackageName,
  initialPackedLength,
  initialPackedWidth,
  initialPackedHeight,
  initialPackedWeight,
  initialPackageOverride,
  calculatedProductWeight,
  availablePresets,
}: OrderPackagingPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Current display state
  const [packagePresetId, setPackagePresetId] = useState<string | null>(initialPackagePresetId || null);
  const [packageName, setPackageName] = useState(
    initialPackageName || (availablePresets.length > 0 ? "Standard Package" : "Direct Product Dimensions (No Box Configured)")
  );
  const [packedLength, setPackedLength] = useState<number>(initialPackedLength || 30);
  const [packedWidth, setPackedWidth] = useState<number>(initialPackedWidth || 25);
  const [packedHeight, setPackedHeight] = useState<number>(initialPackedHeight || 20);
  const [packedWeight, setPackedWeight] = useState<number>(initialPackedWeight || Math.max(0.5, calculatedProductWeight + 0.2));
  const [packageOverride, setPackageOverride] = useState<boolean>(initialPackageOverride || false);

  // Form editing state
  const [formPresetId, setFormPresetId] = useState<string>(packagePresetId || "");
  const [formPackageName, setFormPackageName] = useState(packageName);
  const [formLength, setFormLength] = useState(packedLength.toString());
  const [formWidth, setFormWidth] = useState(packedWidth.toString());
  const [formHeight, setFormHeight] = useState(packedHeight.toString());
  const [formWeight, setFormWeight] = useState(packedWeight.toString());

  const openModal = () => {
    setFormPresetId(packagePresetId || "");
    setFormPackageName(packageName);
    setFormLength(packedLength.toString());
    setFormWidth(packedWidth.toString());
    setFormHeight(packedHeight.toString());
    setFormWeight(packedWeight.toString());
    setIsDialogOpen(true);
  };

  const handlePresetSelect = (presetId: string) => {
    setFormPresetId(presetId);
    if (!presetId) {
      setFormPackageName("Custom Package");
      return;
    }

    const preset = availablePresets.find((p) => p.id === presetId);
    if (preset) {
      setFormPackageName(preset.name);
      setFormLength(preset.length.toString());
      setFormWidth(preset.width.toString());
      setFormHeight(preset.height.toString());
      const newTotal = Math.round((calculatedProductWeight + preset.emptyWeight) * 1000) / 1000;
      setFormWeight(newTotal.toString());
    }
  };

  const handleSave = () => {
    const l = parseFloat(formLength);
    const w = parseFloat(formWidth);
    const h = parseFloat(formHeight);
    const wt = parseFloat(formWeight);

    if (isNaN(l) || l <= 0 || isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
      toast({ title: "Dimensions must be greater than 0", variant: "destructive" });
      return;
    }
    if (isNaN(wt) || wt <= 0) {
      toast({ title: "Packed weight must be greater than 0", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      const res = await updateOrderPackaging({
        orderId,
        packagePresetId: formPresetId || null,
        packageName: formPackageName.trim() || "Custom Box",
        packedLength: l,
        packedWidth: w,
        packedHeight: h,
        packedWeight: wt,
        packageOverride: true,
      });

      if (res.success) {
        setPackagePresetId(formPresetId || null);
        setPackageName(formPackageName.trim() || "Custom Box");
        setPackedLength(l);
        setPackedWidth(w);
        setPackedHeight(h);
        setPackedWeight(wt);
        setPackageOverride(true);
        setIsDialogOpen(false);
        toast({ title: "Packaging Updated", description: "Packed dimensions and weight saved." });
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    });
  };

  const volumeLiters = ((packedLength * packedWidth * packedHeight) / 1000).toFixed(1);

  return (
    <>
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Box className="h-4 w-4 text-primary" />
            Packaging &amp; Box Allocation
          </CardTitle>
          <div className="flex items-center gap-2">
            {packageOverride ? (
              <Badge variant="outline" className="text-amber-800 bg-amber-50 border-amber-300 text-xs">
                Staff Override
              </Badge>
            ) : (!packagePresetId && availablePresets.length === 0) ? (
              <Badge variant="outline" className="text-slate-700 bg-slate-50 border-slate-300 text-xs font-semibold">
                Product Dimensions
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs font-semibold">
                Auto Selected
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={openModal} className="h-8 gap-1.5 text-xs">
              <Pencil className="h-3.5 w-3.5" />
              Change Box
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <span className="text-xs text-slate-500 block">Package Preset</span>
              <span className="font-semibold text-slate-900 text-sm mt-0.5 block truncate">
                {packageName}
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <span className="text-xs text-slate-500 block">Dimensions</span>
              <span className="font-mono text-slate-900 text-sm mt-0.5 block">
                {packedLength} × {packedWidth} × {packedHeight} cm
              </span>
              <span className="text-[10px] text-slate-400">({volumeLiters} L)</span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <span className="text-xs text-slate-500 block">Items Net Weight</span>
              <span className="font-semibold text-slate-900 text-sm mt-0.5 block">
                {calculatedProductWeight.toFixed(2)} kg
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <span className="text-xs text-slate-500 block">Total Packed Weight</span>
              <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                {packedWeight.toFixed(2)} kg
              </span>
              <span className="text-[10px] text-slate-400">
                (incl. box tare: {Math.max(0, packedWeight - calculatedProductWeight).toFixed(2)} kg)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Override / Manual Package Selection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Packed Box &amp; Dimensions</DialogTitle>
            <DialogDescription>
              Select an existing packaging preset or enter the actual packed dimensions and weight before creating the shipment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="preset-select">Select Packaging Preset</Label>
              <select
                id="preset-select"
                value={formPresetId}
                onChange={(e) => handlePresetSelect(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Custom / Manual Dimensions</option>
                {availablePresets
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.length}×{p.width}×{p.height} cm, max {p.maxWeight}kg, tare +{p.emptyWeight}kg)
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="box-name">Package Label</Label>
              <Input
                id="box-name"
                value={formPackageName}
                onChange={(e) => setFormPackageName(e.target.value)}
                placeholder="e.g. Small, Medium, Custom Box"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="box-length">Length (cm)</Label>
                <Input
                  id="box-length"
                  type="number"
                  step="0.1"
                  min="1"
                  value={formLength}
                  onChange={(e) => setFormLength(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="box-width">Breadth (cm)</Label>
                <Input
                  id="box-width"
                  type="number"
                  step="0.1"
                  min="1"
                  value={formWidth}
                  onChange={(e) => setFormWidth(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="box-height">Height (cm)</Label>
                <Input
                  id="box-height"
                  type="number"
                  step="0.1"
                  min="1"
                  value={formHeight}
                  onChange={(e) => setFormHeight(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="box-weight">
                Total Packed Weight (kg) <span className="text-xs text-slate-500 font-normal">(including box)</span>
              </Label>
              <Input
                id="box-weight"
                type="number"
                step="0.05"
                min="0.1"
                value={formWeight}
                onChange={(e) => setFormWeight(e.target.value)}
              />
              <p className="text-[11px] text-slate-500">
                Products weight: {calculatedProductWeight.toFixed(2)} kg
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Package Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

