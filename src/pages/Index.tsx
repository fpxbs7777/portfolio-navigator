import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { IOLTest } from "@/components/IOLTest";
import { ProfileSelector, PortfolioDetail } from "@/components/PortfolioView";
import { Glossary } from "@/components/Glossary";
import { Checklist } from "@/components/Checklist";
import { PortfolioEngine } from "@/components/PortfolioEngine";
import type { ProfileKey } from "@/data/iolData";
import {
  Compass,
  ClipboardCheck,
  BookOpen,
  LayoutGrid,
  ArrowRight,
  Sparkles,
  Quote,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Section = "test" | "portfolios" | "engine" | "checklist" | "glossary";

const Index = () => {
  const [section, setSection] = useState<Section>("test");
  const [selectedProfile, setSelectedProfile] = useState<ProfileKey>("moderado");
  const portfolioRef = useRef<HTMLDivElement>(null);

  const handleProfileFromTest = (key: ProfileKey) => {
    setSelectedProfile(key);
    setSection("portfolios");
    setTimeout(() => {
      portfolioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const navItems: { key: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "test", label: "Test de perfil", icon: Compass },
    { key: "portfolios", label: "Portafolios", icon: LayoutGrid },
    { key: "checklist", label: "Checklist", icon: ClipboardCheck },
    { key: "glossary", label: "Glosario", icon: BookOpen },
  ];

  const goToEngine = () => {
    setSection("engine");
    setTimeout(() => portfolioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  return (
    <div className="min-h-screen bg-background paper-texture">
      {/* Header sticky */}
      <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border/60">
        <div className="container max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-gold flex items-center justify-center shadow-gold">
              <Sparkles className="w-4 h-4 text-primary" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-serif text-base text-foreground leading-tight">Asesoría IOL</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Guía de portafolios
              </div>
            </div>
          </div>
          <nav className="hidden md:flex items-center gap-1 bg-secondary/60 rounded-full p-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setSection(item.key)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-smooth flex items-center gap-2",
                  section === item.key
                    ? "bg-card text-primary shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
        {/* Mobile nav */}
        <div className="md:hidden border-t border-border/60 px-2 py-2 flex gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-smooth flex items-center gap-1.5",
                section === item.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground bg-secondary"
              )}
            >
              <item.icon className="w-3 h-3" />
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-warm opacity-60" aria-hidden />
        <div className="container max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card/80 backdrop-blur border border-accent/30 text-xs uppercase tracking-widest text-accent-foreground mb-6 shadow-soft">
              <Sparkles className="w-3 h-3 text-accent" />
              Metodología IOL · Filosofía Buffett · Mercado Argentino
            </div>
            <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl text-foreground leading-[1.05] tracking-tight mb-6 text-balance">
              Tu guía rápida para armar el{" "}
              <span className="italic text-primary">portafolio correcto</span>{" "}
              en cada reunión.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl text-pretty mb-8">
              Test de perfil IOL interactivo, portafolios concretos con tickers BYMA, checklist
              de construcción y glosario buscable. Todo lo que necesitás para asesorar con
              precisión y velocidad.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setSection("test")}
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-14 px-8 text-base shadow-warm"
              >
                Comenzar test de perfil <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                onClick={() => setSection("portfolios")}
                variant="outline"
                size="lg"
                className="rounded-full h-14 px-8 text-base border-border bg-card/60 backdrop-blur hover:bg-card"
              >
                Ver los 7 portafolios
              </Button>
            </div>
          </div>

          {/* Stats banda */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-16 max-w-4xl">
            {[
              { v: "7", l: "Perfiles IOL" },
              { v: "60+", l: "Tickers concretos" },
              { v: "20", l: "Términos clave" },
              { v: "23", l: "Checks de control" },
            ].map((s, i) => (
              <div key={i} className="border-l-2 border-accent pl-4">
                <div className="font-serif text-3xl md:text-4xl text-foreground">{s.v}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sección activa */}
      <main
        ref={portfolioRef}
        className="container max-w-7xl mx-auto px-4 md:px-8 py-12 md:py-20"
      >
        {section === "test" && (
          <div className="max-w-3xl mx-auto">
            <SectionHeader
              eyebrow="Paso 1"
              title="Detectá el perfil de tu cliente"
              description="6 preguntas, basadas en la metodología IOL. El sistema mide horizonte temporal y tolerancia al riesgo, y te devuelve el perfil exacto con su portafolio sugerido."
            />
            <IOLTest onProfileDetected={handleProfileFromTest} />
          </div>
        )}

        {section === "portfolios" && (
          <div>
            <SectionHeader
              eyebrow="Paso 2"
              title="Portafolios por perfil"
              description="Cada portafolio integra activos disponibles en BYMA / IOL con peso sugerido, divisa y frecuencia de revisión. Referencia educativa, no recomendación personalizada."
            />
            <div className="mb-8">
              <ProfileSelector selected={selectedProfile} onSelect={setSelectedProfile} />
            </div>
            <PortfolioDetail profileKey={selectedProfile} onAnalyzeLive={goToEngine} />
          </div>
        )}

        {section === "engine" && (
          <div>
            <SectionHeader
              eyebrow="En vivo"
              title="Motor de portfolio en vivo"
              description="Conectá tu cuenta IOL (opcional) o usá el modo demo. Analiza el panel elegido y rankea cada activo con un score de salud financiera (P/E, ROE, D/E, márgenes, dividendo). Genera el portfolio sugerido para el perfil activo."
            />
            <PortfolioEngine
              selectedProfile={selectedProfile}
              onProfileChange={setSelectedProfile}
            />
          </div>
        )}

        {section === "checklist" && (
          <div className="max-w-4xl mx-auto">
            <SectionHeader
              eyebrow="Paso 3"
              title="Checklist de construcción"
              description="Verificá cada punto antes de invertir el primer peso. Si algún ítem falla, el portafolio no está listo."
            />
            <Checklist />
          </div>
        )}

        {section === "glossary" && (
          <div>
            <SectionHeader
              eyebrow="Referencia"
              title="Glosario ETFs y mercado argentino"
              description="Buscá cualquier término durante la reunión con tu cliente. Filtrá por categoría para acceso rápido."
            />
            <Glossary />
          </div>
        )}
      </main>

      {/* Cita Buffett */}
      <section className="bg-primary text-primary-foreground py-16 md:py-24">
        <div className="container max-w-4xl mx-auto px-4 md:px-8 text-center">
          <Quote className="w-10 h-10 text-accent mx-auto mb-6" />
          <blockquote className="font-serif text-2xl md:text-4xl leading-tight italic text-balance">
            "La diversificación es protección contra la ignorancia. No tiene mucho sentido para
            quien sabe lo que hace."
          </blockquote>
          <div className="mt-6 text-sm uppercase tracking-widest text-primary-foreground/60">
            — Warren Buffett
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="container max-w-7xl mx-auto px-4 md:px-8 py-10 text-center">
          <p className="text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Esta guía tiene carácter exclusivamente educativo. Las asignaciones de portafolio son
            referencias generales basadas en la metodología IOL y no constituyen asesoramiento
            financiero personalizado. Consultá con un Agente Productor regulado CNV antes de tomar
            decisiones de inversión.
          </p>
        </div>
      </footer>
    </div>
  );
};

const SectionHeader = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) => (
  <div className="mb-10 md:mb-14 max-w-3xl">
    <div className="text-xs uppercase tracking-widest text-accent font-medium mb-3">
      {eyebrow}
    </div>
    <h2 className="font-serif text-3xl md:text-5xl text-foreground leading-tight tracking-tight mb-4 text-balance">
      {title}
    </h2>
    <p className="text-muted-foreground text-base md:text-lg leading-relaxed text-pretty">
      {description}
    </p>
  </div>
);

export default Index;
