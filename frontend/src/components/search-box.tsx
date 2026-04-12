import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { autocompleteBooks, fetchSuggestions } from "@/lib/queries";

const SearchIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const XIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export default function SearchBox({ size = "default" }: { size?: "default" | "large" }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const enabled = trimmed.length >= 2;

  const { data: results = [] } = useQuery({
    queryKey: ["autocomplete", trimmed],
    queryFn: () => autocompleteBooks(trimmed),
    enabled,
    staleTime: 1000 * 30,
  });

  const { data: suggestions } = useQuery({
    queryKey: ["suggestions", trimmed],
    queryFn: () => fetchSuggestions(trimmed),
    enabled,
    staleTime: 1000 * 30,
  });

  const hasResults = results.length > 0;
  const hasCategories = (suggestions?.categories.length ?? 0) > 0;
  const hasAuthors = (suggestions?.authors.length ?? 0) > 0;
  const showDropdown = focused && (hasResults || hasCategories || hasAuthors);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (enabled) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
      setFocused(false);
    }
  };

  const handleSelect = (id: string) => {
    setFocused(false);
    navigate(`/books/${id}`);
  };

  const handleSearchByName = (name: string) => {
    setFocused(false);
    navigate(`/search?q=${encodeURIComponent(name)}`);
  };

  const handleClear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isLarge = size === "large";

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div className={`group relative flex items-center rounded-2xl border border-border/70 bg-card transition-all focus-within:border-gold/50 focus-within:shadow-warm ${isLarge ? "h-14 shadow-warm" : "h-11"}`}>
          <span className={`pointer-events-none absolute inset-y-0 right-0 flex items-center text-muted-foreground/60 ${isLarge ? "right-5" : "right-3.5"}`}>
            <SearchIcon className={isLarge ? "h-5 w-5" : "h-4 w-4"} />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="ابحث عن كتاب، مؤلف، أو تصنيف..."
            className={`w-full bg-transparent outline-none placeholder:text-muted-foreground/55 ${
              isLarge ? "h-full pr-14 pl-14 text-base" : "h-full pr-10 pl-10 text-sm"
            }`}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="مسح"
              className={`absolute inset-y-0 left-0 flex items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground ${isLarge ? "left-3" : "left-2"}`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted">
                <XIcon className="h-3.5 w-3.5" />
              </span>
            </button>
          )}
        </div>
      </form>

      {showDropdown && (
        <div className="absolute top-full right-0 z-50 mt-2 w-full overflow-hidden rounded-2xl border border-border/70 bg-popover p-1.5 shadow-warm-lg">
          {hasResults && (
            <div>
              <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">كتب</p>
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm transition-colors hover:bg-accent"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                  </span>
                  <span className="line-clamp-1 flex-1">{item.title}</span>
                </button>
              ))}
            </div>
          )}

          {hasAuthors && (
            <div className={hasResults ? "mt-1 border-t border-border/60 pt-1" : ""}>
              <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">مؤلفون</p>
              {suggestions!.authors.map((author) => (
                <button
                  key={author.id}
                  type="button"
                  onClick={() => handleSearchByName(author.name)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm transition-colors hover:bg-accent"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/15 text-gold">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <span className="flex-1">{author.name}</span>
                </button>
              ))}
            </div>
          )}

          {hasCategories && (
            <div className={hasResults || hasAuthors ? "mt-1 border-t border-border/60 pt-1" : ""}>
              <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">تصنيفات</p>
              {suggestions!.categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSearchByName(cat.name)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm transition-colors hover:bg-accent"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  </span>
                  <span className="flex-1">{cat.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
