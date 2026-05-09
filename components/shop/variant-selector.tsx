"use client";

import { useState, useMemo } from "react";
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
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    if (!defaultVariant) return {};
    return defaultVariant.values.reduce((acc, v) => {
      acc[v.variantValue.variantAttribute.id] = v.variantValue.id;
      return acc;
    }, {} as Record<string, string>);
  });

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

  const getAvailableValues = (attributeId: string, valueId: string) => {
    const testSelections = { ...selections, [attributeId]: valueId };
    const partialKey = attributes
      .map((attr) => {
        const selValueId = testSelections[attr.id];
        if (!selValueId) return null;
        const value = attr.variantValues.find((v) => v.id === selValueId);
        return value ? `${attr.name}:${value.value}` : null;
      })
      .filter(Boolean)
      .join("|");

    return Object.keys(variantMap).some((variantKey) =>
      variantKey.startsWith(partialKey) || variantKey.includes(partialKey)
    );
  };

  const handleSelect = (attributeId: string, valueId: string) => {
    setSelections((prev) => ({ ...prev, [attributeId]: valueId }));
  };

  return (
    <div className="space-y-3">
      {/* Variant Attributes */}
      {attributes.map((attribute) => (
        <div key={attribute.id}>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
            {attribute.name}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {attribute.variantValues.map((value) => {
              const isSelected = selections[attribute.id] === value.id;
              const isAvailable = getAvailableValues(attribute.id, value.id);

              return (
                <button
                  key={value.id}
                  onClick={() => isAvailable && handleSelect(attribute.id, value.id)}
                  disabled={!isAvailable}
                  className={cn(
                    "relative px-3 py-1.5 rounded-md border text-xs font-medium transition-all",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : isAvailable
                      ? "border-border bg-white hover:border-primary/50"
                      : "border-border/50 bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                  )}
                >
                  {value.hexCode && (
                    <span
                      className="inline-block w-3 h-3 rounded-full mr-1.5 border border-border align-middle"
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

      {/* Selected Variant Info - Compact */}
      {selectedVariant && (
        <div className="flex items-center justify-between py-2 border-t border-border text-sm">
          <span className="text-muted-foreground">
            {selectedVariant.stock > 0 ? (
              <span className="text-green-600">● In Stock</span>
            ) : (
              <span className="text-destructive">Out of stock</span>
            )}
          </span>
          {selectedVariant.memberPrice && (
            <span className="text-primary font-medium">
              Member: ${selectedVariant.memberPrice.toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
