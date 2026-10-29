"use client";

import { useState, useMemo, useEffect } from "react";
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
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
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
  images: {
    id: string;
    url: string;
    displayOrder: number;
  }[];
}

interface VariantSelectorProps {
  attributes: VariantAttribute[];
  variants: ProductVariant[];
  variantMap: Record<string, ProductVariant>;
  defaultVariant: ProductVariant | null;
  onVariantChange?: (variant: ProductVariant | null) => void;
}

export function VariantSelector({
  attributes,
  variants,
  variantMap,
  defaultVariant,
  onVariantChange,
}: VariantSelectorProps) {
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    if (!defaultVariant) return {};
    return defaultVariant.values.reduce((acc, v) => {
      acc[v.variantValue.variantAttribute.id] = v.variantValue.id;
      return acc;
    }, {} as Record<string, string>);
  });

  // Keep selections in sync if defaultVariant changes (e.g. navigation or URL change)
  useEffect(() => {
    if (!defaultVariant) return;
    const newSelections = defaultVariant.values.reduce((acc, v) => {
      acc[v.variantValue.variantAttribute.id] = v.variantValue.id;
      return acc;
    }, {} as Record<string, string>);
    setSelections(newSelections);
  }, [defaultVariant?.id]);

  // Find selected variant based on all selections
  const selectedVariant = useMemo(() => {
    const key = attributes
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((attr) => {
        const valueId = selections[attr.id];
        const value = attr.variantValues.find((v) => v.id === valueId);
        return value ? `${attr.name}:${value.value}` : "";
      })
      .filter(Boolean)
      .join("|");
    return variantMap[key] || null;
  }, [selections, attributes, variantMap]);

  // Notify parent when variant changes
  useEffect(() => {
    onVariantChange?.(selectedVariant);
  }, [selectedVariant, onVariantChange]);

  const handleSelect = (attributeId: string, valueId: string) => {
    setSelections((prev) => {
      const newSelections = { ...prev, [attributeId]: valueId };
      
      // Check if the new combination is valid
      const newKey = attributes
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((attr) => {
          const selValueId = newSelections[attr.id];
          const value = attr.variantValues.find((v) => v.id === selValueId);
          return value ? `${attr.name}:${value.value}` : "";
        })
        .filter(Boolean)
        .join("|");
      
      // If invalid, clear subsequent selections
      if (!variantMap[newKey]) {
        // Find the index of the current attribute
        const attrIndex = attributes.findIndex((a) => a.id === attributeId);
        // Clear all selections after this one
        attributes.slice(attrIndex + 1).forEach((attr) => {
          delete newSelections[attr.id];
        });
      }
      
      return newSelections;
    });
  };

  // Get available values for each attribute
  const availableValuesByAttribute = useMemo(() => {
    // Get available values for an attribute given current selections
    const getAvailableValuesForAttribute = (attributeId: string) => {
      const available = new Set<string>();

      variants.forEach((variant) => {
        const variantValues = variant.values;
        // Check if this variant matches all current selections (except for the attribute we're checking)
        const matches = attributes.every((attr) => {
          if (attr.id === attributeId) return true; // Skip the attribute we're checking
          const selectedValueId = selections[attr.id];
          if (!selectedValueId) return true; // No selection yet, consider it a match
          return variantValues.some(
            (v) => v.variantValue.variantAttribute.id === attr.id &&
                   v.variantValue.id === selectedValueId
          );
        });

        if (matches) {
          const valueForAttr = variantValues.find(
            (v) => v.variantValue.variantAttribute.id === attributeId
          );
          if (valueForAttr) {
            available.add(valueForAttr.variantValue.id);
          }
        }
      });

      return available;
    };

    const available: Record<string, Set<string>> = {};
    attributes.forEach((attr) => {
      available[attr.id] = getAvailableValuesForAttribute(attr.id);
    });
    return available;
  }, [selections, attributes, variants]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Variant Attributes */}
      {attributes.map((attribute) => {
        const availableValues = availableValuesByAttribute[attribute.id] || new Set();
        const selectedValue = attribute.variantValues.find(value => value.id === selections[attribute.id]);
        
        return (
          <div key={attribute.id} className="space-y-1.5 sm:space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="font-semibold text-foreground">
                {attribute.name}:{" "}
                <span className="font-normal text-muted-foreground">
                  {selectedValue?.value || "Select option"}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {attribute.variantValues.map((value) => {
                const isSelected = selections[attribute.id] === value.id;
                const isAvailable = availableValues.has(value.id);

                return (
                  <button
                    key={value.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => isAvailable && handleSelect(attribute.id, value.id)}
                    disabled={!isAvailable}
                    className={cn(
                      "relative inline-flex min-h-9 sm:min-h-10 items-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl border px-3 sm:px-3.5 py-1 sm:py-1.5 text-xs sm:text-sm font-medium transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary shadow-xs"
                        : isAvailable
                        ? "border-border bg-white text-foreground hover:border-primary/50"
                        : "border-border/50 bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                    )}
                  >
                    {value.hexCode && (
                      <span
                        className="inline-block h-3.5 w-3.5 rounded-full border border-foreground/20 shrink-0"
                        style={{ backgroundColor: value.hexCode }}
                      />
                    )}
                    <span className="capitalize">{value.value}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
