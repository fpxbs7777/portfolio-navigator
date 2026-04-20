import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { iolTest, determineProfile, profiles, type ProfileKey } from "@/data/iolData";
import { ArrowRight, RotateCcw, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface IOLTestProps {
  onProfileDetected: (profile: ProfileKey) => void;
}

export const IOLTest = ({ onProfileDetected }: IOLTestProps) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ProfileKey | null>(null);

  const currentQ = iolTest[step];
  const progress = (step / iolTest.length) * 100;

  const handleAnswer = (score: number) => {
    const newAnswers = { ...answers, [currentQ.id]: score };
    setAnswers(newAnswers);

    if (step < iolTest.length - 1) {
      setTimeout(() => setStep(step + 1), 200);
    } else {
      // Calcular perfil
      const htScore = iolTest
        .filter((q) => q.dimension === "HT")
        .reduce((sum, q) => sum + (newAnswers[q.id] || 0), 0);
      const trScore = iolTest
        .filter((q) => q.dimension === "TR")
        .reduce((sum, q) => sum + (newAnswers[q.id] || 0), 0);

      const profile = determineProfile(htScore, trScore);
      setResult(profile);
    }
  };

  const reset = () => {
    setStep(0);
    setAnswers({});
    setResult(null);
  };

  if (result) {
    const p = profiles[result];
    return (
      <Card className="p-8 md:p-12 shadow-warm border-accent/30 bg-card animate-scale-in">
        <div className="flex items-center gap-3 text-accent mb-2">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-xs uppercase tracking-widest font-medium">Perfil detectado</span>
        </div>
        <h3 className="font-serif text-3xl md:text-4xl text-foreground mb-2">{p.name}</h3>
        <p className="text-accent italic font-serif text-lg mb-6">{p.tagline}</p>
        <p className="text-muted-foreground leading-relaxed mb-8">{p.description}</p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-success-soft rounded-xl p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Renta Variable</div>
            <div className="font-serif text-2xl text-success">{p.allocation.rv}%</div>
          </div>
          <div className="bg-primary-soft rounded-xl p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Renta Fija</div>
            <div className="font-serif text-2xl text-primary">{p.allocation.rf}%</div>
          </div>
          <div className="bg-accent-soft rounded-xl p-4 text-center">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Caja</div>
            <div className="font-serif text-2xl text-accent-foreground">{p.allocation.cash}%</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => onProfileDetected(result)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6 h-12 flex-1"
          >
            Ver portafolio completo <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            onClick={reset}
            variant="outline"
            className="rounded-full h-12 border-border hover:bg-secondary"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Repetir test
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-8 md:p-12 shadow-warm border-border/60 bg-card">
      <div className="mb-8">
        <div className="flex justify-between text-xs uppercase tracking-widest text-muted-foreground mb-3">
          <span>Pregunta {step + 1} de {iolTest.length}</span>
          <span className="text-accent font-medium">
            {currentQ.dimension === "HT" ? "Horizonte temporal" : "Tolerancia al riesgo"}
          </span>
        </div>
        <Progress value={progress} className="h-1.5 bg-secondary [&>div]:bg-accent" />
      </div>

      <h3 key={currentQ.id} className="font-serif text-2xl md:text-3xl text-foreground mb-8 leading-tight animate-fade-up">
        {currentQ.question}
      </h3>

      <div className="space-y-3">
        {currentQ.options.map((opt, i) => (
          <button
            key={`${currentQ.id}-${i}`}
            onClick={() => handleAnswer(opt.score)}
            className={cn(
              "w-full text-left p-5 rounded-xl border border-border bg-background/50",
              "hover:border-accent hover:bg-accent-soft hover:shadow-soft",
              "transition-smooth group flex items-center justify-between gap-4",
              answers[currentQ.id] === opt.score && "border-accent bg-accent-soft"
            )}
          >
            <span className="text-foreground font-medium">{opt.label}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-smooth shrink-0" />
          </button>
        ))}
      </div>
    </Card>
  );
};
