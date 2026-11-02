"use client";

import { useState, useTransition } from "react";
import {
  Box,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Scale,
  Maximize2,
  Weight,
  Layers,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  createPackagingPreset,
  updatePackagingPreset,
  deletePackagingPreset,
  togglePackagingPresetActive,
  seedDefaultPackagingPresets,
} from "@/lib/actions/packaging";
import type { PackagingPresetType } from "@/lib/packaging";

export function PackagingClient({ initialPresets }: { initialPresets: PackagingPresetType[] }) {
  const [presets, setPresets] = useState<PackagingPresetType[]>(initialPresets);
  const [isPending, startTransition] = useTransition();

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PackagingPresetType | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [length, setLength] = useState("30");
  const [width, setWidth] = useState("25");
  const [height, setHeight] = useState("20");
  const [maxWeight, setMaxWeight] = useState("3.0");
  const [emptyWeight, setEmptyWeight] = useState("0.2");
  const [priority, setPriority] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const openAddDialog = () => {
    setEditingPreset(null);
    setName("");
    setLength("30");
    setWidth("25");
    setHeight("20");
    setMaxWeight("3.0");
    setEmptyWeight("0.2");
    setPriority("0");
    setIsActive(true);
    setIsDialogOpen(true);
  };

  const openEditDialog = (preset: PackagingPresetType) => {
    setEditingPreset(preset);
    setName(preset.name);
    setLength(preset.length.toString());
    setWidth(preset.width.toString());
    setHeight(preset.height.toString());
    setMaxWeight(preset.maxWeight.toString());
    setEmptyWeight(preset.emptyWeight.toString());
    setPriority(preset.priority.toString());
    setIsActive(preset.isActive);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }

    const l = parseFloat(length);
    const b = parseFloat(width);
    const h = parseFloat(height);
    const mw = parseFloat(maxWeight);
    const ew = parseFloat(emptyWeight);
    const p = parseInt(priority) || 0;

    if (isNaN(l) || l <= 0 || isNaN(b) || b <= 0 || isNaN(h) || h <= 0) {
      toast({ title: "Dimensions must be positive numbers", variant: "destructive" });
      return;
    }
    if (isNaN(mw) || mw <= 0) {
      toast({ title: "Maximum weight must be positive", variant: "destructive" });
      return;
    }
    if (isNaN(ew) || ew < 0) {
      toast({ title: "Empty box weight cannot be negative", variant: "destructive" });
      return;
    }

    startTransition(async () => {
      if (editingPreset) {
        const res = await updatePackagingPreset(editingPreset.id, {
          name: name.trim(),
          length: l,
          width: b,
          height: h,
          maxWeight: mw,
          emptyWeight: ew,
          priority: p,
          isActive,
        });

        if (res.success && res.preset) {
          setPresets((prev) =>
            prev.map((item) => (item.id === editingPreset.id ? res.preset! : item))
          );
          setIsDialogOpen(false);
          toast({ title: "Packaging preset updated", description: `Updated ${name.trim()}` });
        } else {
          toast({ title: "Error", description: res.error || "Failed to update", variant: "destructive" });
        }
      } else {
        const res = await createPackagingPreset({
          name: name.trim(),
          length: l,
          width: b,
          height: h,
          maxWeight: mw,
          emptyWeight: ew,
          priority: p,
          isActive,
        });

        if (res.success && res.preset) {
          setPresets((prev) => [res.preset!, ...prev]);
          setIsDialogOpen(false);
          toast({ title: "Packaging preset created", description: `Added ${name.trim()}` });
        } else {
          toast({ title: "Error", description: res.error || "Failed to create", variant: "destructive" });
        }
      }
    });
  };

  const handleToggle = (preset: PackagingPresetType) => {
    const nextState = !preset.isActive;
    startTransition(async () => {
      const res = await togglePackagingPresetActive(preset.id, nextState);
      if (res.success) {
        setPresets((prev) =>
          prev.map((item) => (item.id === preset.id ? { ...item, isActive: nextState } : item))
        );
        toast({
          title: nextState ? "Preset Activated" : "Preset Disabled",
          description: `${preset.name} is now ${nextState ? "active" : "inactive"} for packaging calculations.`,
        });
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    });
  };

  const handleDelete = (id: string, presetName: string) => {
    if (!confirm(`Are you sure you want to delete the "${presetName}" packaging preset?`)) return;

    startTransition(async () => {
      const res = await deletePackagingPreset(id);
      if (res.success) {
        setPresets((prev) => prev.filter((item) => item.id !== id));
        toast({ title: "Deleted", description: `Removed preset ${presetName}` });
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    });
  };

  const handleSeedDefaults = () => {
    startTransition(async () => {
      const res = await seedDefaultPackagingPresets();
      if (res.success) {
        window.location.reload();
      } else {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header card with action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Box className="h-6 w-6 text-primary" />
            Packaging Configuration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure standard box sizes and tare weights. The system automatically selects the smallest
            suitable box based on cart weights and dimensions.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleSeedDefaults} disabled={isPending}>
            <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
            Load Defaults
          </Button>
          <Button onClick={openAddDialog} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Packaging Preset
          </Button>
        </div>
      </div>

      {/* Info Guide Card */}
      <Card className="bg-slate-50/70 border-slate-200">
        <CardContent className="pt-4 pb-4 text-xs text-slate-600 grid sm:grid-cols-3 gap-3">
          <div className="flex items-start gap-2">
            <Scale className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900">Tare Weight Calculation</p>
              <p>Empty box weight is added to the product weight to compute accurate billable shipping weight.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Maximize2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900">3D Dimensional Fit</p>
              <p>Items are rotated across all 3 dimensions to ensure they physically fit into the box.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Layers className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900">Optimal Box Selection</p>
              <p>The smallest box satisfying weight capacity and physical dimensions is chosen automatically.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table of presets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Available Presets ({presets.length})</span>
            <span className="text-xs font-normal text-slate-500">
              Sorted by Priority &amp; Maximum Capacity
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 text-left">Package Name</th>
                  <th className="py-3 px-4 text-left">Dimensions (L × B × H)</th>
                  <th className="py-3 px-4 text-left">Volume</th>
                  <th className="py-3 px-4 text-left">Max Weight</th>
                  <th className="py-3 px-4 text-left">Empty Box Weight</th>
                  <th className="py-3 px-4 text-center">Priority</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {presets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <Box className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                      <p className="font-medium">No packaging presets configured</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Click "Load Defaults" or "Add Packaging Preset" to configure your boxes.
                      </p>
                    </td>
                  </tr>
                ) : (
                  presets.map((preset) => {
                    const volumeLiters = (
                      (preset.length * preset.width * preset.height) /
                      1000
                    ).toFixed(1);

                    return (
                      <tr key={preset.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {preset.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {preset.length} × {preset.width} × {preset.height} cm
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs">
                          {volumeLiters} L
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-900">{preset.maxWeight} kg</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-600">{preset.emptyWeight} kg ({Math.round(preset.emptyWeight * 1000)}g)</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline" className="font-mono text-xs">
                            {preset.priority}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggle(preset)}
                            disabled={isPending}
                            className="cursor-pointer"
                            title={preset.isActive ? "Click to disable" : "Click to enable"}
                          >
                            {preset.isActive ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                                <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-600" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-slate-500 bg-slate-50">
                                <XCircle className="mr-1 h-3 w-3 text-slate-400" />
                                Disabled
                              </Badge>
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(preset)}
                              disabled={isPending}
                              title="Edit Preset"
                            >
                              <Pencil className="h-4 w-4 text-slate-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(preset.id, preset.name)}
                              disabled={isPending}
                              title="Delete Preset"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingPreset ? "Edit Packaging Preset" : "Add Packaging Preset"}
            </DialogTitle>
            <DialogDescription>
              Configure dimensions, weight limits, and empty box tare weight.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="preset-name">
                Package Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="preset-name"
                placeholder="e.g. Small, Medium, Large, Extra Large"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="preset-length">Length (cm)</Label>
                <Input
                  id="preset-length"
                  type="number"
                  step="0.1"
                  min="1"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preset-width">Breadth (cm)</Label>
                <Input
                  id="preset-width"
                  type="number"
                  step="0.1"
                  min="1"
                  value={width}
                  onChange={(e) => setWidth(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preset-height">Height (cm)</Label>
                <Input
                  id="preset-height"
                  type="number"
                  step="0.1"
                  min="1"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="preset-maxweight">Maximum Weight (kg)</Label>
                <Input
                  id="preset-maxweight"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={maxWeight}
                  onChange={(e) => setMaxWeight(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preset-emptyweight">Empty Box Weight (kg)</Label>
                <Input
                  id="preset-emptyweight"
                  type="number"
                  step="0.05"
                  min="0"
                  value={emptyWeight}
                  onChange={(e) => setEmptyWeight(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="preset-priority">Selection Priority</Label>
                <Input
                  id="preset-priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
                <p className="text-[11px] text-slate-500">Higher number checked first</p>
              </div>

              <div className="flex flex-col justify-between py-1">
                <Label htmlFor="preset-active">Active for Selection</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Switch
                    id="preset-active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                  <span className="text-xs text-slate-600">
                    {isActive ? "Enabled" : "Disabled"}
                  </span>
                </div>
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
            <Button onClick={handleSave} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPreset ? "Save Changes" : "Create Preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

