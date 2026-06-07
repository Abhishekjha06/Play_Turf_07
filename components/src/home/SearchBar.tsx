import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useLuxuryTheme } from "@/luxury/LuxuryThemeProvider";
import { trackEvent } from "@/lib/analytics";

export function SearchBar() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { themeId } = useLuxuryTheme();

  // Both premium-teal and amoled-black have the search bar embedded in the collapsing AppHeader
  if (themeId === "premium-teal" || themeId === "amoled-black") return null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) navigate(`/?q=${encodeURIComponent(q.trim())}`);
      }}
      className="px-4 mt-3"
    >
      <label className="flex items-center gap-3 bg-panel-2 rounded-full px-4 h-12 border border-border focus-within:border-primary/60 transition-colors shadow-sm">
        <Search className="h-5 w-5 text-muted2" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            trackEvent("Search Executed", { query: e.target.value });
          }}
          placeholder="Search for turfs, locations, offers…"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted2"
          data-testid="search-input"
        />
      </label>
    </form>
  );
}
