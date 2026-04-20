import { profiles, profileOrder, type ProfileKey } from "@/data/iolData";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Target, Activity } from "lucide-react";

interface ProfileSelectorProps {
  selected: ProfileKey;
  onSelect: (key: ProfileKey) => void;
}

export const ProfileSelector = ({ selected, onSelect }: ProfileSelectorProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {profileOrder.map((key) => {
        const p = profiles[key];
        const isActive = selected === key;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={cn(
              "p-4 rounded-xl border text-left transition-smooth group",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-warm"
                : "bg-card border-border hover:border-accent hover:shadow-soft"
            )}
          >
            <div className={cn(
              "text-xs uppercase tracking-wider mb-2 font-medium",
              isActive ? "text-primary-foreground/70" : "text-muted-foreground"
            )}>
              {p.horizon.split("/")[0].trim()}
            </div>
            <div className={cn(
              "font-serif text-base leading-tight mb-1",
              isActive ? "text-primary-foreground" : "text-foreground"
            )}>
              {p.name}
            </div>
            <div className={cn(
              "text-xs",
              isActive ? "text-primary-foreground/60" : "text-muted-foreground"
            )}>
              RV {p.allocation.rv}%
            </div>
          </button>
        );
      })}
    </div>
  );
};

interface PortfolioDetailProps {
  profileKey: ProfileKey;
  onAnalyzeLive?: () => void;
}

export const PortfolioDetail = ({ profileKey, onAnalyzeLive }: PortfolioDetailProps) => {
  const p = profiles[profileKey];

  return (
    <div key={profileKey} className="animate-fade-up space-y-6">
      <Card className="p-8 md:p-10 bg-gradient-paper border-border/60 shadow-card">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-accent font-medium mb-2">
              {p.horizon}
            </div>
            <h3 className="font-serif text-3xl md:text-4xl text-foreground">{p.name}</h3>
            <p className="text-accent italic font-serif text-lg mt-1">{p.tagline}</p>
          </div>
          <div className="flex gap-2">
            <span className="px-3 py-1 rounded-full bg-success-soft text-success text-xs font-medium">
              RV {p.allocation.rv}%
            </span>
            <span className="px-3 py-1 rounded-full bg-primary-soft text-primary text-xs font-medium">
              RF {p.allocation.rf}%
            </span>
            <span className="px-3 py-1 rounded-full bg-accent-soft text-accent-foreground text-xs font-medium">
              Caja {p.allocation.cash}%
            </span>
          </div>
        </div>

        <p className="text-foreground/80 leading-relaxed mb-6 text-pretty">{p.description}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={Target} label="Drawdown tolerable" value={p.drawdown} variant="muted" />
          <Stat icon={TrendingUp} label="Retorno esperado" value={p.expectedReturn} variant="success" />
          <Stat icon={TrendingUp} label="Mejor escenario" value={p.bestCase} variant="success" />
          <Stat icon={TrendingDown} label="Peor escenario" value={p.worstCase} variant="destructive" />
        </div>
      </Card>

      <Card className="p-6 md:p-8 bg-card border-border/60 shadow-card">
        <h4 className="font-serif text-2xl text-foreground mb-1">Composición sugerida</h4>
        <p className="text-sm text-muted-foreground mb-6">
          Activos concretos disponibles en BYMA / IOL
        </p>

        <div className="overflow-x-auto -mx-6 md:-mx-8">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-3 px-6 md:px-8 font-medium">Clase de activo</th>
                <th className="pb-3 px-2 font-medium">Ticker / Instrumento</th>
                <th className="pb-3 px-2 font-medium text-right">Peso</th>
                <th className="pb-3 px-2 font-medium">Divisa</th>
                <th className="pb-3 px-6 md:px-8 font-medium">Revisión</th>
              </tr>
            </thead>
            <tbody>
              {p.portfolio.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-border/50 hover:bg-secondary/40 transition-smooth"
                >
                  <td className="py-4 px-6 md:px-8 font-medium text-foreground">{row.asset}</td>
                  <td className="py-4 px-2 text-muted-foreground font-mono text-xs">
                    {row.ticker}
                  </td>
                  <td className="py-4 px-2 text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${Math.min(row.weight * 1.5, 100)}%` }}
                        />
                      </div>
                      <span className="font-serif text-base text-foreground tabular-nums w-10 text-right">
                        {row.weight}%
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-xs text-muted-foreground">{row.currency}</td>
                  <td className="py-4 px-6 md:px-8 text-xs text-muted-foreground">{row.review}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6 bg-primary-soft/40 border-primary/20">
          <h5 className="font-serif text-xl text-primary mb-3">Estrategia</h5>
          <p className="text-foreground/80 text-sm leading-relaxed text-pretty">{p.strategy}</p>
        </Card>
        <Card className="p-6 bg-accent-soft/50 border-accent/30">
          <h5 className="font-serif text-xl text-accent-foreground mb-3">
            Tips para asesorar este perfil
          </h5>
          <ul className="space-y-2">
            {p.tips.map((tip, i) => (
              <li key={i} className="text-sm text-foreground/80 flex gap-2">
                <span className="text-accent shrink-0 mt-1">→</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
};

interface StatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  variant: "success" | "destructive" | "muted";
}

const Stat = ({ icon: Icon, label, value, variant }: StatProps) => {
  const styles = {
    success: "bg-success-soft text-success",
    destructive: "bg-destructive-soft text-destructive",
    muted: "bg-secondary text-foreground",
  };
  return (
    <div className={cn("rounded-xl p-4", styles[variant])}>
      <div className="flex items-center gap-1.5 mb-2 opacity-70">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="font-serif text-lg leading-tight">{value}</div>
    </div>
  );
};
