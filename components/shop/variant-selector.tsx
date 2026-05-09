"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

interface VariantAttribute {
  id: string;
  name: string;
  displayOrder: number;
  variantValues: {
    id: string;
    value: string;
    hexCode: string | null;
  }[];
}

interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  comparePrice: number | null;
  memberPrice: number | null;
  stock: number;
  isActive: boolean;
  values: {
    variantValue: {
      id: string;
      value: string;
      hexCode: string | null;
      variantAttribute: {
        id: string;
        name: string;
      };
    };
  }[];
}

interface VariantSelectorProps {
  attributes: VariantAttribute[];
  variants: ProductVariant[];
  variantMap: Record<string, ProductVariant>;
  defaultVariant: ProductVariant | null;
}

export function VariantSelector({
  attributes,
  variants,
  variantMap,
  defaultVariant,
}: VariantSelectorProps) {
  // Initialize selections from default variant
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    if (!defaultVariant) return {};
    return defaultVariant.values.reduce((acc, v) => {
      acc[v.variantValue.variantAttribute.id] = v.variantValue.id;
      return acc;
    }, {} as Record<string, string>);
  });

  // Update selected variant when selections change
  const selectedVariant = useMemo(() => {
    const key = attributes
      .map((attr) => {
        const valueId = selections[attr.id];
        const value = attr.variantValues.find((v) => v.id === valueId);
        return value ? `${attr.name}:${value.value}` : "";
      })
      .filter(Boolean)
      .join("|");
    return variantMap[key] || null;
  }, [selections, attributes, variantMap]);

  // Find available values for each attribute based on current selections
  const getAvailableValues = (attributeId: string, valueId: string) => {
    // Check if this combination exists in any variant
    const testSelections = { ...selections, [attributeId]: valueId };
    
    // Build partial key with current selections
    const partialKey = attributes
      .map((attr) => {
        const selValueId = testSelections[attr.id];
        if (!selValueId) return null;
        const value = attr.variantValues.find((v) => v.id === selValueId);
        return value ? `${attr.name}:${value.value}` : null;
      })
      .filter(Boolean)
      .join("|");

    // Check if any variant matches this partial key
    return Object.keys(variantMap).some((variantKey) =>
      variantKey.startsWith(partialKey) || variantKey.includes(partialKey)
    );
  };

  const handleSelect = (attributeId: string, valueId: string) => {
    setSelections((prev) => ({ ...prev, [attributeId]: valueId }));
  };

  return (
    <div className="space-y-4">
      {/* Variant Attributes */}
      {attributes.map((attribute) => (
        <div key={attribute.id}>
          <label className="block text-sm font-medium text-foreground mb-2">
            {attribute.name}
          </label>
          <div className="flex flex-wrap gap-2">
            {attribute.variantValues.map((value) => {
              const isSelected = selections[attribute.id] === value.id;
              const isAvailable = getAvailableValues(attribute.id, value.id);

              return (
                <button
                  key={value.id}
                  onClick={() => isAvailable && handleSelect(attribute.id, value.id)}
                  disabled={!isAvailable}
                  className={cn(
                    "relative px-4 py-2 rounded-lg border text-sm font-medium transition-all",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : isAvailable
                      ? "border-border bg-white hover:border-primary/50"
                      : "border-border/50 bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                  )}
                >
                  {/* Color swatch for color attributes */}
                  {value.hexCode && (
                    <span
                      className="inline-block w-4 h-4 rounded-full mr-2 border border-border"
                      style={{ backgroundColor: value.hexCode }}
                    />
                  )}
                  {value.value}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Selected Variant Info */}
      {selectedVariant && (
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Selected:</span>
            <span className="font-medium">{selectedVariant.sku}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Price:</span>
            <span className="text-lg font-bold">${selectedVariant.price.toLocaleString()}</span>
          </div>
          {selectedVariant.comparePrice && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Compare at:</span>
              <span className="text-sm line-through text-muted-foreground">
                ${selectedVariant.comparePrice.toLocaleString()}
              </span>
            </div>
          )}
          {selectedVariant.memberPrice && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Member Price:</span>
              <span className="text-sm font-medium text-primary">
                ${selectedVariant.memberPrice.toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm text-muted-foreground">Stock:</span>
            <span
              className={cn(
                "text-sm font-medium",
                selectedVariant.stock > 0 ? "text-green-600" : "text-destructive"
              )}
            >
              {selectedVariant.stock > 0 ? `${selectedVariant.stock} available` : "Out of stock"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
