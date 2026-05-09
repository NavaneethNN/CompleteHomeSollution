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
  // Build a lookup of which value combinations exist
  const validCombinations = useMemo(() => {
    const combos = new Set<string>();
    variants.forEach((variant) => {
      const key = variant.values
        .map((v) => `${v.variantValue.variantAttribute.id}:${v.variantValue.id}`)
        .sort()
        .join("|");
      combos.add(key);
    });
    return combos;
  }, [variants]);

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

  const [selections, setSelections] = useState<Record<string, string>>(() => {
    if (!defaultVariant) return {};
    return defaultVariant.values.reduce((acc, v) => {
      acc[v.variantValue.variantAttribute.id] = v.variantValue.id;
      return acc;
    }, {} as Record<string, string>);
  });

  // Find selected variant based on all selections
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

  // Notify parent when variant changes
  useEffect(() => {
    onVariantChange?.(selectedVariant);
  }, [selectedVariant, onVariantChange]);

  const handleSelect = (attributeId: string, valueId: string) => {
    setSelections((prev) => {
      const newSelections = { ...prev, [attributeId]: valueId };
      
      // Check if the new combination is valid
      const newKey = attributes
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
    const available: Record<string, Set<string>> = {};
    attributes.forEach((attr) => {
      available[attr.id] = getAvailableValuesForAttribute(attr.id);
    });
    return available;
  }, [selections, attributes, variants]);

  return (
    <div className="space-y-3">
      {/* Variant Attributes */}
      {attributes.map((attribute) => {
        const availableValues = availableValuesByAttribute[attribute.id] || new Set();
        
        return (
          <div key={attribute.id}>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
              {attribute.name}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {attribute.variantValues.map((value) => {
                const isSelected = selections[attribute.id] === value.id;
                const isAvailable = availableValues.has(value.id);

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
        );
      })}

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
