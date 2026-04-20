import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { glossary } from "@/data/iolData";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Glossary = () => {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("Todos");

  const categories = useMemo(
    () => ["Todos", ...Array.from(new Set(glossary.map((g) => g.category)))],
    []
  );

  const filtered = useMemo(() => {
    return glossary.filter((g) => {
      const matchesCat = activeCat === "Todos" || g.category === activeCat;
      const matchesQuery =
        !query ||
        g.term.toLowerCase().includes(query.toLowerCase()) ||
        g.definition.toLowerCase().includes(query.toLowerCase());
      return matchesCat && matchesQuery;
    });
  }, [query, activeCat]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar término…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11 h-12 rounded-full bg-card border-border focus-visible:ring-accent"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={cn(
                "px-4 h-9 rounded-full text-xs uppercase tracking-wider font-medium transition-smooth",
                activeCat === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-accent-soft hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {filtered.map((g) => (
          <Card
            key={g.term}
            className="p-5 bg-card border-border/60 hover:border-accent/50 hover:shadow-soft transition-smooth"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h4 className="font-serif text-xl text-foreground">{g.term}</h4>
              <span className="px-2.5 py-1 rounded-full bg-accent-soft text-accent-foreground text-[10px] uppercase tracking-wider font-medium shrink-0">
                {g.category}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
              {g.definition}
            </p>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="md:col-span-2 p-10 text-center text-muted-foreground">
            No se encontraron términos para "{query}"
          </Card>
        )}
      </div>
    </div>
  );
};
