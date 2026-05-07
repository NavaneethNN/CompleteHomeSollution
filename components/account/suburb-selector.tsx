"use client";

import { useState, useMemo } from "react";
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
import { AUSTRALIAN_SUBURBS, Suburb, getSuburbsByState } from "@/lib/data/australian-suburbs";

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
  const [open, setOpen] = useState(false);

  const suburbs = useMemo(() => {
    if (state) {
      return getSuburbsByState(state);
    }
    return AUSTRALIAN_SUBURBS;
  }, [state]);

  const selectedSuburb = suburbs.find((suburb) => suburb.name === value);

  return (
    <div className="space-y-2">
      <Label htmlFor="suburb" className="text-sm font-medium flex items-center gap-2">
        <MapPinned className="h-4 w-4 text-muted-foreground" />
        Suburb
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
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
            <CommandInput placeholder="Search suburb..." />
            <CommandList>
              <CommandEmpty>No suburb found.</CommandEmpty>
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
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
