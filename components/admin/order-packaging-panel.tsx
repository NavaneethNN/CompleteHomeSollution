"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  Plus,
  Trash2,
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
import type { PackedBoxSpec } from "@/lib/shipping-packages";

interface EditablePackedBox {
  label: string;
  quantity: string;
  length: string;
  width: string;
  height: string;
  weight: string;
}

interface OrderPackagingPanelProps {
  orderId: string;
  initialPackagePresetId?: string | null;
  initialPackageName?: string | null;
  initialPackedLength?: number | null;
  initialPackedWidth?: number | null;
  initialPackedHeight?: number | null;
  initialPackedWeight?: number | null;
  initialPackedBoxes?: PackedBoxSpec[];
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
  initialPackedBoxes,
  initialPackageOverride,
  calculatedProductWeight,
  availablePresets,
}: OrderPackagingPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Current display state
  const fallbackPreset = availablePresets.length > 0 ? availablePresets[0] : null;
  const [packagePresetId, setPackagePresetId] = useState<string | null>(initialPackagePresetId || fallbackPreset?.id || null);
  const [packageName, setPackageName] = useState(
    initialPackageName || fallbackPreset?.name || "Direct Product Dimensions (No Box Configured)"
  );
  const [packedLength, setPackedLength] = useState<number>(initialPackedLength || fallbackPreset?.length || 30);
  const [packedWidth, setPackedWidth] = useState<number>(initialPackedWidth || fallbackPreset?.width || 25);
  const [packedHeight, setPackedHeight] = useState<number>(initialPackedHeight || fallbackPreset?.height || 20);
  const [packedWeight, setPackedWeight] = useState<number>(
    initialPackedWeight || Math.max(0.5, calculatedProductWeight + (fallbackPreset?.emptyWeight ?? 0.2))
  );
  const [packedBoxes, setPackedBoxes] = useState<PackedBoxSpec[]>(() =>
    initialPackedBoxes && initialPackedBoxes.length > 0
      ? initialPackedBoxes
      : [
          {
            label: initialPackageName || fallbackPreset?.name || "Standard Box",
            quantity: 1,
            length: initialPackedLength || fallbackPreset?.length || 30,
            width: initialPackedWidth || fallbackPreset?.width || 25,
            height: initialPackedHeight || fallbackPreset?.height || 20,
            weight: initialPackedWeight || Math.max(0.5, calculatedProductWeight + (fallbackPreset?.emptyWeight ?? 0.2)),
          },
        ]
  );
  const [packageOverride, setPackageOverride] = useState<boolean>(initialPackageOverride || false);

  useEffect(() => {
    if (initialPackagePresetId !== undefined) setPackagePresetId(initialPackagePresetId);
    if (initialPackageName) setPackageName(initialPackageName);
    if (initialPackedLength) setPackedLength(initialPackedLength);
    if (initialPackedWidth) setPackedWidth(initialPackedWidth);
    if (initialPackedHeight) setPackedHeight(initialPackedHeight);
    if (initialPackedWeight) setPackedWeight(initialPackedWeight);
    if (initialPackedBoxes && initialPackedBoxes.length > 0) setPackedBoxes(initialPackedBoxes);
    if (initialPackageOverride !== undefined) setPackageOverride(initialPackageOverride || false);
  }, [
    initialPackagePresetId,
    initialPackageName,
    initialPackedLength,
    initialPackedWidth,
    initialPackedHeight,
    initialPackedWeight,
    initialPackedBoxes,
    initialPackageOverride,
  ]);

  // Form editing state
  const [formPresetId, setFormPresetId] = useState<string>(packagePresetId || "");
  const [formPackageName, setFormPackageName] = useState(packageName);
  const [formBoxes, setFormBoxes] = useState<EditablePackedBox[]>(() =>
    packedBoxes.map((b) => ({
      label: b.label,
      quantity: String(b.quantity),
      length: String(b.length),
      width: String(b.width),
      height: String(b.height),
      weight: String(b.weight),
    }))
  );

  const openModal = () => {
    setFormPresetId(packagePresetId || "");
    setFormPackageName(packageName);
    setFormBoxes(
      packedBoxes.map((b) => ({
        label: b.label,
        quantity: String(b.quantity),
        length: String(b.length),
        width: String(b.width),
        height: String(b.height),
        weight: String(b.weight),
      }))
    );
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
      const newTotal = Math.round((calculatedProductWeight + preset.emptyWeight) * 1000) / 1000;
      setFormPackageName(preset.name);
      setFormBoxes([
        {
          label: preset.name,
          quantity: "1",
          length: preset.length.toString(),
          width: preset.width.toString(),
          height: preset.height.toString(),
          weight: newTotal.toString(),
        },
      ]);
    }
  };

  const updateFormBox = (index: number, field: keyof EditablePackedBox, value: string) => {
    setFormBoxes((prev) => prev.map((box, i) => (i === index ? { ...box, [field]: value } : box)));
  };

  const handleSave = () => {
    const validatedBoxes: PackedBoxSpec[] = [];
    for (let i = 0; i < formBoxes.length; i++) {
      const box = formBoxes[i];
      const q = parseInt(box.quantity, 10);
      const l = parseFloat(box.length);
      const w = parseFloat(box.width);
      const h = parseFloat(box.height);
      const wt = parseFloat(box.weight);
      if (isNaN(q) || q < 1) {
        toast({ title: `Box ${i + 1} quantity must be at least 1`, variant: "destructive" });
        return;
      }
      if (isNaN(l) || l <= 0 || isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
        toast({ title: `Box ${i + 1} dimensions must be greater than 0`, variant: "destructive" });
        return;
      }
      if (isNaN(wt) || wt <= 0) {
        toast({ title: `Box ${i + 1} weight must be greater than 0`, variant: "destructive" });
        return;
      }
      validatedBoxes.push({
        label: box.label.trim() || (formBoxes.length === 1 ? formPackageName.trim() || "Custom Box" : `Box ${i + 1}`),
        quantity: q,
        length: Math.round(l * 10) / 10,
        width: Math.round(w * 10) / 10,
        height: Math.round(h * 10) / 10,
        weight: Math.round(wt * 100) / 100,
      });
    }

    const totalQty = validatedBoxes.reduce((s, b) => s + b.quantity, 0);
    const totalWt = Math.round(validatedBoxes.reduce((s, b) => s + b.weight * b.quantity, 0) * 100) / 100;
    const first = validatedBoxes[0];
    const resolvedName =
      totalQty === 1
        ? formPackageName.trim() || first.label || "Custom Box"
        : formPackageName.trim() && formBoxes.length === 1
          ? formPackageName.trim()
          : `${totalQty} Boxes (Separate Packaging)`;

    startTransition(async () => {
      const res = await updateOrderPackaging({
        orderId,
        packagePresetId: validatedBoxes.length === 1 && formPresetId ? formPresetId : null,
        packageName: resolvedName,
        packedLength: first.length,
        packedWidth: first.width,
        packedHeight: first.height,
        packedWeight: totalWt,
        packedBoxes: validatedBoxes,
        packageOverride: true,
      });

      if (res.success) {
        setPackagePresetId(validatedBoxes.length === 1 && formPresetId ? formPresetId : null);
        setPackageName(resolvedName);
        setPackedLength(first.length);
        setPackedWidth(first.width);
        setPackedHeight(first.height);
        setPackedWeight(totalWt);
        setPackedBoxes(validatedBoxes);
        setPackageOverride(true);
        setIsDialogOpen(false);
        toast({ title: "Packaging Updated", description: "Packed box dimensions and weight saved." });
        router.refresh();
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    });
  };

  const totalBoxesCount = packedBoxes.reduce((sum, b) => sum + b.quantity, 0);
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
            ) : packageName?.includes("Estimated Minimum") ? (
              <Badge variant="outline" className="text-blue-800 bg-blue-50 border-blue-300 text-xs font-semibold">
                Estimated Minimum
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
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 flex flex-col justify-between">
              <span className="text-xs text-slate-500 block">Package Preset</span>
              <span className="font-semibold text-slate-900 text-sm mt-0.5 block line-clamp-2 leading-snug" title={packageName}>
                {packageName}
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 flex flex-col justify-between">
              <span className="text-xs text-slate-500 block">
                {totalBoxesCount > 1 ? "First Box Dimensions" : "Dimensions"}
              </span>
              <div className="mt-0.5">
                <span className="font-mono text-slate-900 text-sm font-semibold whitespace-nowrap block">
                  {packedLength} × {packedWidth} × {packedHeight} cm
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {totalBoxesCount > 1 ? `${totalBoxesCount} separate boxes` : `(${volumeLiters} L)`}
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 flex flex-col justify-between">
              <span className="text-xs text-slate-500 block">Items Net Weight</span>
              <span className="font-semibold text-slate-900 text-sm mt-0.5 block whitespace-nowrap">
                {calculatedProductWeight.toFixed(2)} kg
              </span>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100 flex flex-col justify-between">
              <span className="text-xs text-slate-500 block">Total Packed Weight</span>
              <div className="mt-0.5">
                <span className="font-bold text-slate-900 text-sm block whitespace-nowrap">
                  {packedWeight.toFixed(2)} kg
                </span>
                <span className="text-[10px] text-slate-400 block">
                  (incl. box tare: {Math.max(0, packedWeight - calculatedProductWeight).toFixed(2)} kg)
                </span>
              </div>
            </div>
          </div>

          {totalBoxesCount > 1 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between font-semibold text-slate-700">
                <span>Separate Courier Boxes</span>
                <span>{totalBoxesCount} boxes</span>
              </div>
              <div className="space-y-1">
                {packedBoxes.map((box, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 text-[11px] text-slate-600 font-mono">
                    <span className="font-sans truncate text-slate-800">
                      {box.quantity}× {box.label}
                    </span>
                    <span className="shrink-0">
                      {box.length}×{box.width}×{box.height} cm · {box.weight.toFixed(2)} kg
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Override / Manual Package Selection Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Packed Box &amp; Dimensions</DialogTitle>
            <DialogDescription>
              Each product and configured box ships separately. Select a preset or adjust the individual boxes below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="preset-select">Quick Apply Packaging Preset</Label>
              <select
                id="preset-select"
                value={formPresetId}
                onChange={(e) => handlePresetSelect(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Custom / Separate Boxes</option>
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
              <Label htmlFor="box-name">Summary Package Label</Label>
              <Input
                id="box-name"
                value={formPackageName}
                onChange={(e) => setFormPackageName(e.target.value)}
                placeholder="e.g. Small, Medium, 2 Boxes (Separate Packaging)"
              />
            </div>

            <div className="space-y-3">
              {formBoxes.map((box, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">Box {idx + 1}</span>
                    {formBoxes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormBoxes((prev) => prev.filter((_, i) => i !== idx))}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Box Label</Label>
                      <Input
                        value={box.label}
                        onChange={(e) => updateFormBox(idx, "label", e.target.value)}
                        placeholder={`Box ${idx + 1}`}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={box.quantity}
                        onChange={(e) => updateFormBox(idx, "quantity", e.target.value)}
                        placeholder="1"
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Length (cm)</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0.1"
                        placeholder="cm"
                        value={box.length}
                        onChange={(e) => updateFormBox(idx, "length", e.target.value)}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Breadth (cm)</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0.1"
                        placeholder="cm"
                        value={box.width}
                        onChange={(e) => updateFormBox(idx, "width", e.target.value)}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Height (cm)</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0.1"
                        placeholder="cm"
                        value={box.height}
                        onChange={(e) => updateFormBox(idx, "height", e.target.value)}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Weight (kg)</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0.05"
                        placeholder="kg"
                        value={box.weight}
                        onChange={(e) => updateFormBox(idx, "weight", e.target.value)}
                        className="h-8 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setFormBoxes((prev) => [
                    ...prev,
                    { label: `Box ${prev.length + 1}`, quantity: "1", length: "", width: "", height: "", weight: "" },
                  ])
                }
                className="h-8 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Another Packaging
              </Button>
            </div>

            <p className="text-[11px] text-slate-500">
              Products weight: {calculatedProductWeight.toFixed(2)} kg
            </p>
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

