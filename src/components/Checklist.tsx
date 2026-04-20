import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { checklist } from "@/data/iolData";
import { cn } from "@/lib/utils";

export const Checklist = () => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const total = checklist.reduce((sum, s) => sum + s.items.length, 0);
  const done = Object.values(checked).filter(Boolean).length;
  const pct = (done / total) * 100;

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-paper border-accent/30 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-accent font-medium mb-1">
              Progreso
            </div>
            <div className="font-serif text-2xl text-foreground">
              {done} de {total} verificados
            </div>
          </div>
          <div className="font-serif text-4xl text-accent tabular-nums">
            {Math.round(pct)}%
          </div>
        </div>
        <Progress value={pct} className="h-2 bg-secondary [&>div]:bg-accent" />
      </Card>

      {checklist.map((section, sIdx) => (
        <Card key={sIdx} className="p-6 md:p-8 bg-card border-border/60 shadow-card">
          <h4 className="font-serif text-xl text-foreground mb-5 flex items-center gap-3">
            <span className="font-serif text-accent text-2xl tabular-nums">
              {String(sIdx + 1).padStart(2, "0")}
            </span>
            {section.title}
          </h4>
          <div className="space-y-1">
            {section.items.map((item, i) => {
              const id = `${sIdx}-${i}`;
              const isChecked = !!checked[id];
              return (
                <label
                  key={id}
                  htmlFor={id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-smooth",
                    "hover:bg-secondary/50",
                    isChecked && "opacity-50"
                  )}
                >
                  <Checkbox
                    id={id}
                    checked={isChecked}
                    onCheckedChange={() => toggle(id)}
                    className="mt-0.5 border-border data-[state=checked]:bg-accent data-[state=checked]:border-accent data-[state=checked]:text-accent-foreground"
                  />
                  <span
                    className={cn(
                      "text-sm text-foreground/90 leading-relaxed",
                      isChecked && "line-through"
                    )}
                  >
                    {item}
                  </span>
                </label>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
};
