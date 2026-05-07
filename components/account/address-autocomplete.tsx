"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home, MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect: (address: {
    line1: string;
    line2?: string;
    suburb: string;
    state: string;
    postcode: string;
    country: string;
  }) => void;
  error?: string;
  disabled?: boolean;
}

interface AutocompleteSuggestion {
  placePrediction?: {
    place: string;
    placeId: string;
    text: {
      text: string;
      matches: Array<{ startOffset: number; endOffset: number }>;
    };
    structuredFormat?: {
      mainText: {
        text: string;
        matches: Array<{ startOffset: number; endOffset: number }>;
      };
      secondaryText?: {
        text: string;
      };
    };
    types: string[];
  };
}

interface SuggestionResponse {
  suggestions: AutocompleteSuggestion[];
}

interface PlaceDetailsResponse {
  id: string;
  displayName?: {
    text: string;
    languageCode: string;
  };
  formattedAddress?: string;
  addressComponents: Array<{
    types: string[];
    longText: string;
    shortText: string;
  }>;
}

declare global {
  interface Window {
    google?: typeof google;
  }
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  error,
  disabled,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const apiKeyRef = useRef<string>("");
  const justSelectedRef = useRef(false);
  const { toast } = useToast();

  // Check if API key is available
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    console.log("[AddressAutocomplete] API Key present:", !!apiKey);
    
    if (!apiKey) {
      setLoadError("API key not configured");
      return;
    }
    apiKeyRef.current = apiKey;
    setIsApiReady(true);
  }, []);

  // Generate a session token for billing efficiency
  const sessionTokenRef = useRef<string>(crypto.randomUUID());

  // Fetch suggestions using new Places API
  const fetchSuggestions = useCallback(async (input: string) => {
    if (!apiKeyRef.current || input.length < 3) {
      setSuggestions([]);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    console.log("[AddressAutocomplete] Fetching suggestions for:", input);

    try {
      const requestBody: Record<string, unknown> = {
        input: input,
        includedRegionCodes: ["au"],
        sessionToken: sessionTokenRef.current,
      };

      console.log("[AddressAutocomplete] Request body:", JSON.stringify(requestBody));

      const response = await fetch(
        `https://places.googleapis.com/v1/places:autocomplete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKeyRef.current,
          },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal,
        }
      );

      console.log("[AddressAutocomplete] Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[AddressAutocomplete] API error:", response.status, errorText);
        if (response.status === 403) {
          setLoadError("API access denied - check Places API (New) is enabled");
          toast({
            title: "API Error",
            description: "Please enable Places API (New) in Google Cloud Console",
            variant: "destructive",
          });
        } else if (response.status === 400) {
          console.error("[AddressAutocomplete] Bad request - check request format");
        }
        setSuggestions([]);
        return;
      }

      const data: SuggestionResponse = await response.json();
      console.log("[AddressAutocomplete] Full response:", JSON.stringify(data, null, 2));
      console.log("[AddressAutocomplete] Got suggestions:", data.suggestions?.length || 0);
      
      setSuggestions(data.suggestions || []);
      setShowSuggestions(true);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Request was cancelled, ignore
      }
      console.error("[AddressAutocomplete] Fetch error:", err);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Debounced fetch
  useEffect(() => {
    if (!isApiReady) return;

    // Skip fetch if we just selected a suggestion (prevents showing suggestions again)
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    const timeoutId = setTimeout(() => {
      if (value.length >= 3) {
        fetchSuggestions(value);
      } else {
        setSuggestions([]);
        setIsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [value, isApiReady, fetchSuggestions]);

  // Fetch place details and parse address
  const handlePlaceSelect = async (suggestion: AutocompleteSuggestion) => {
    const placePrediction = suggestion.placePrediction;
    if (!placePrediction || !apiKeyRef.current) return;

    console.log("[AddressAutocomplete] Selected place:", placePrediction.placeId);
    setIsLoading(true);
    setShowSuggestions(false);
    setSuggestions([]);
    justSelectedRef.current = true;

    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${placePrediction.placeId}`,
        {
          method: "GET",
          headers: {
            "X-Goog-Api-Key": apiKeyRef.current,
            "X-Goog-FieldMask": "id,displayName,formattedAddress,addressComponents",
          },
        }
      );

      if (!response.ok) {
        console.error("[AddressAutocomplete] Place details error:", response.status);
        toast({
          title: "Error",
          description: "Failed to get address details. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const place: PlaceDetailsResponse = await response.json();
      console.log("[AddressAutocomplete] Place details:", place);

      let line1 = "";
      let line2 = "";
      let suburb = "";
      let state = "";
      let postcode = "";
      let country = "AU";

      place.addressComponents?.forEach((component) => {
        const types = component.types;
        
        if (types.includes("street_number")) {
          line1 = component.longText + (line1 ? " " + line1 : "");
        }
        if (types.includes("route")) {
          line1 = line1 ? line1 + " " + component.longText : component.longText;
        }
        if (types.includes("subpremise")) {
          line2 = component.longText;
        }
        if (types.includes("locality")) {
          suburb = component.longText;
        }
        if (types.includes("administrative_area_level_1")) {
          state = component.shortText;
        }
        if (types.includes("postal_code")) {
          postcode = component.longText;
        }
        if (types.includes("country")) {
          country = component.shortText;
        }
      });

      // If no street_number/route, use formatted address
      if (!line1 && place.formattedAddress) {
        const parts = place.formattedAddress.split(",");
        line1 = parts[0]?.trim() || "";
      }

      console.log("[AddressAutocomplete] Parsed address:", { line1, line2, suburb, state, postcode, country });

      onChange(line1);
      onAddressSelect({
        line1,
        line2: line2 || undefined,
        suburb,
        state,
        postcode,
        country,
      });
    } catch (err) {
      console.error("[AddressAutocomplete] Error getting place details:", err);
      toast({
        title: "Error",
        description: "Failed to get address details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const displayText = (suggestion: AutocompleteSuggestion) => {
    const pred = suggestion.placePrediction;
    if (!pred) return "";
    
    return pred.structuredFormat?.mainText?.text || pred.text?.text || "";
  };

  const displaySecondary = (suggestion: AutocompleteSuggestion) => {
    const pred = suggestion.placePrediction;
    if (!pred) return "";
    
    return pred.structuredFormat?.secondaryText?.text || "";
  };

  return (
    <div className="space-y-2" ref={inputRef}>
      <Label htmlFor="line1" className="text-sm font-medium flex items-center gap-2">
        <Home className="h-4 w-4 text-muted-foreground" />
        Street Address
      </Label>
      <div className="relative">
        <Input
          id="line1"
          type="text"
          placeholder={isApiReady ? "Start typing your address..." : "Enter address manually..."}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => value.length >= 3 && suggestions.length > 0 && setShowSuggestions(true)}
          disabled={disabled}
          className="pr-10"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!isLoading && isApiReady && (
          <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
      </div>
      
      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.placePrediction?.placeId || index}
              type="button"
              onClick={() => handlePlaceSelect(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-b-0"
            >
              <div className="font-medium text-sm">
                {displayText(suggestion)}
              </div>
              {displaySecondary(suggestion) && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {displaySecondary(suggestion)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      
      {!isApiReady && loadError && (
        <p className="text-xs text-amber-600">
          Address autocomplete unavailable: {loadError}. Please enter address manually.
        </p>
      )}
      
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
