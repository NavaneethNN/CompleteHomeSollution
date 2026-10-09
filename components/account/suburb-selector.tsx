"use client";

import { useState, useMemo, useId } from "react";
import { Check, ChevronsUpDown, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AUSTRALIAN_SUBURBS, getSuburbsByState } from "@/lib/data/australian-suburbs";

interface SuburbSelectorProps {
  value: string;
  onChange: (value: string) => void;
  state?: string;
  error?: string;
  disabled?: boolean;
}

export function SuburbSelector({
  value,
  onChange,
  state,
  error,
  disabled,
}: SuburbSelectorProps) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const suburbs = useMemo(() => {
    if (state) {
      return getSuburbsByState(state);
    }
    return AUSTRALIAN_SUBURBS;
  }, [state]);


  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId} className="text-sm font-medium flex items-center gap-2">
        <MapPinned className="h-4 w-4 text-muted-foreground" />
        Suburb
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={fieldId}
            type="button"
            aria-invalid={!!error}
            aria-describedby={error ? `${fieldId}-error` : undefined}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              !value && "text-muted-foreground",
              error && "border-destructive"
            )}
            disabled={disabled}
          >
            {value || "Select suburb..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0">
          <Command>
            <CommandInput aria-label="Search suburb" placeholder="Search or enter suburb..." value={query} onValueChange={setQuery} maxLength={50} />
            <CommandList>
              <CommandEmpty>
                <p>No matching suggestion.</p>
                {query.trim() && <Button type="button" variant="outline" className="mt-2" onClick={() => {
                  onChange(query.trim());
                  setOpen(false);
                }}>Use “{query.trim()}”</Button>}
              </CommandEmpty>
              <CommandGroup heading={state ? `${state} Suburbs` : "All Suburbs"}>
                {suburbs.map((suburb) => (
                  <CommandItem
                    key={`${suburb.name}-${suburb.postcode}`}
                    value={suburb.name}
                    onSelect={(currentValue: string) => {
                      onChange(currentValue === value ? "" : currentValue);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === suburb.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1">{suburb.name}</span>
                    <span className="text-xs text-muted-foreground">{suburb.postcode}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p id={`${fieldId}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
