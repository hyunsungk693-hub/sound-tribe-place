import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

interface PlaceResult {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
}

interface PlaceSearchInputProps {
  value: string;
  placeholder?: string;
  selected?: boolean;
  onSelect: (place: { name: string; lat: number; lng: number }) => void;
  onChange: (value: string) => void;
}

const PlaceSearchInput = ({ value, placeholder, selected, onSelect, onChange }: PlaceSearchInputProps) => {
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&accept-language=ko&q=${encodeURIComponent(q)}`,
          { headers: { Accept: "application/json" } }
        );
        const data: PlaceResult[] = await res.json();
        setResults(data);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const shortName = (p: PlaceResult) => p.name || p.display_name.split(",")[0];

  const pick = (p: PlaceResult) => {
    skipNextSearch.current = true;
    onSelect({ name: shortName(p), lat: parseFloat(p.lat), lng: parseFloat(p.lon) });
    setOpen(false);
    setResults([]);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="text-sm pr-8"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : selected ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <MapPin className="w-4 h-4" />
          )}
        </div>
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-[10000] mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-background shadow-lg">
          {results.map((p, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => pick(p)}
                className="w-full text-left px-3 py-2 hover:bg-secondary transition-colors flex items-start gap-2"
              >
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{shortName(p)}</span>
                  <span className="block text-xs text-muted-foreground truncate">{p.display_name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PlaceSearchInput;
