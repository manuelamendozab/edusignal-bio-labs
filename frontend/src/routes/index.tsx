import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Brain,
  HeartPulse,
  Sparkles,
  Waves,
  Filter,
  LineChart,
  Bot,
  Upload,
  Cpu,
  Eye,
  GraduationCap,
  ShieldCheck,
  Lightbulb,
  Microscope,
  Mail,
  ArrowRight,
  ArrowDown,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-signals.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduSignal — Laboratorio Virtual Inteligente para Bioseñales" },
      {
        name: "description",
        content:
          "Aprende procesamiento digital de señales fisiológicas (ECG, EMG, EEG) con un laboratorio virtual interactivo impulsado por IA.",
      },
      { property: "og:title", content: "EduSignal — Laboratorio Virtual de Bioseñales" },
      {
        property: "og:description",
        content:
          "Plataforma educativa con visualización, filtrado y análisis inteligente de bioseñales para estudiantes de bioingeniería.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <About />
        <Features />
        <HowItWorks />
        <ArchitectureSection />
        <Benefits />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand shadow-glow">
        <Activity className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
      </div>
      <span className="font-display text-xl font-bold tracking-tight">
        Edu<span className="text-gradient-brand">Signal</span>
      </span>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#acerca" className="transition hover:text-foreground">Acerca</a>
          <a href="#caracteristicas" className="transition hover:text-foreground">Características</a>
          <a href="#como-funciona" className="transition hover:text-foreground">Cómo funciona</a>
          <a href="#arquitectura" className="transition hover:text-foreground">Arquitectura</a>
          <a href="#beneficios" className="transition hover:text-foreground">Beneficios</a>
          <a href="#contacto" className="transition hover:text-foreground">Contacto</a>
        </nav>
        <div className="flex items-center gap-2">
          <a href="/laboratorio" className="hidden sm:inline-flex">
            <Button variant="ghost" size="sm">
              Laboratorio
            </Button>
          </a>
          <a href="/chat" className="hidden sm:inline-flex">
            <Button variant="ghost" size="sm">
              Asistente
            </Button>
          </a>
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
            Iniciar sesión
          </Button>
          <Button size="sm" className="bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95">
            Comenzar
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-hero text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen"
        style={{
          backgroundImage: `url(${heroImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        aria-hidden
      />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-24 md:py-32 lg:grid-cols-2 lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-teal" />
            Plataforma educativa de bioseñales
          </div>
          <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            Edu<span className="text-gradient-brand">Signal</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/80 md:text-xl">
            Laboratorio Virtual Inteligente para el Aprendizaje de Bioseñales.
          </p>
          <p className="mt-3 max-w-xl text-base text-white/60">
            Explora, procesa y comprende señales ECG, EMG y EEG con herramientas interactivas
            diseñadas para estudiantes de bioingeniería y áreas afines.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/laboratorio">
              <Button
                size="lg"
                className="bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95"
              >
                Abrir laboratorio
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </a>
            <Button
              size="lg"
              variant="outline"
              className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              Conocer más
            </Button>
          </div>

          <div className="mt-10 grid max-w-md grid-cols-3 gap-4 text-sm">
            {[
              { k: "ECG", label: "Cardíaco" },
              { k: "EMG", label: "Muscular" },
              { k: "EEG", label: "Cerebral" },
            ].map((s) => (
              <div
                key={s.k}
                className="rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur"
              >
                <div className="font-display text-xl font-bold text-teal">{s.k}</div>
                <div className="text-xs text-white/60">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <HeroSignalCard />
      </div>
    </section>
  );
}

function HeroSignalCard() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-3xl bg-gradient-brand opacity-25 blur-3xl" aria-hidden />
      <div className="relative rounded-2xl border border-white/10 bg-deep/60 p-6 shadow-glow backdrop-blur-xl">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span className="font-mono">señal_ecg_001.csv</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" />
            En vivo
          </span>
        </div>
        <div className="mt-4 rounded-xl bg-black/40 p-4">
          <svg viewBox="0 0 400 140" className="h-40 w-full">
            <defs>
              <linearGradient id="ecgGrad" x1="0" x2="1">
                <stop offset="0%" stopColor="oklch(0.74 0.13 195)" />
                <stop offset="100%" stopColor="oklch(0.72 0.15 230)" />
              </linearGradient>
            </defs>
            {[...Array(8)].map((_, i) => (
              <line key={i} x1={i * 50} y1="0" x2={i * 50} y2="140" stroke="rgba(255,255,255,0.05)" />
            ))}
            <path
              d="M0 70 L40 70 L50 70 L55 40 L60 100 L65 70 L100 70 L140 70 L150 70 L155 30 L160 110 L165 70 L200 70 L240 70 L250 70 L255 35 L260 105 L265 70 L300 70 L340 70 L350 70 L355 40 L360 100 L365 70 L400 70"
              fill="none"
              stroke="url(#ecgGrad)"
              strokeWidth="2"
              className="animate-pulse-line"
            />
          </svg>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            { l: "BPM", v: "72" },
            { l: "QRS", v: "12" },
            { l: "HRV", v: "48ms" },
          ].map((m) => (
            <div key={m.l} className="rounded-lg bg-white/5 p-2.5">
              <div className="font-display text-lg font-bold text-white">{m.v}</div>
              <div className="text-[10px] uppercase tracking-wider text-white/50">{m.l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <div className="text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
      {desc && <p className="mt-4 text-base text-muted-foreground md:text-lg">{desc}</p>}
    </div>
  );
}

function About() {
  const signals = [
    {
      icon: HeartPulse,
      name: "ECG",
      desc: "Actividad eléctrica del corazón. Permite analizar ritmo cardíaco, complejos QRS y arritmias.",
    },
    {
      icon: Waves,
      name: "EMG",
      desc: "Actividad eléctrica muscular. Ideal para estudiar contracciones, activación y fatiga muscular.",
    },
    {
      icon: Brain,
      name: "EEG",
      desc: "Actividad cerebral. Revela bandas Delta, Theta, Alpha, Beta y Gamma asociadas al estado mental.",
    },
  ];
  return (
    <section id="acerca" className="bg-gradient-soft py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="Acerca de EduSignal"
          title="¿Qué son las bioseñales?"
          desc="Las bioseñales son registros eléctricos generados por el cuerpo humano. EduSignal traduce su complejidad técnica en una experiencia visual e interactiva, ideal para aprender procesamiento digital de señales."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {signals.map((s) => (
            <div
              key={s.name}
              className="group rounded-2xl border border-border bg-card p-7 shadow-card transition hover:-translate-y-1 hover:shadow-glow"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-glow">
                <s.icon className="h-6 w-6" />
              </div>
              <div className="mt-5 font-display text-xl font-bold">{s.name}</div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: LineChart,
      title: "Visualización interactiva",
      desc: "Grafica señales con zoom, selección de segmentos y comparación antes/después del procesamiento.",
    },
    {
      icon: Filter,
      title: "Filtrado automático",
      desc: "Aplica filtros pasa bajas, pasa altas y elimina ruido con un solo clic, con explicación pedagógica.",
    },
    {
      icon: Eye,
      title: "Detección de eventos",
      desc: "Identifica complejos QRS, contracciones musculares y patrones cerebrales relevantes.",
    },
    {
      icon: Activity,
      title: "Cálculo de métricas",
      desc: "Frecuencia cardíaca, HRV, RMS, MAV, bandas de potencia y más métricas estándar del área.",
    },
    {
      icon: Bot,
      title: "Asistente inteligente",
      desc: "Un tutor basado en IA que responde dudas conceptuales de procesamiento digital de señales.",
    },
    {
      icon: Microscope,
      title: "Laboratorio virtual",
      desc: "Simula filtros y observa el efecto de cada parámetro en tiempo real sobre la señal.",
    },
  ];
  return (
    <section id="caracteristicas" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="Características"
          title="Todo lo que necesitas para aprender bioseñales"
          desc="Una caja de herramientas pensada para el aula: técnica rigurosa, interfaz amable."
        />
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-card transition hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Upload, title: "Cargar señal", desc: "Sube tu archivo CSV, TXT o MAT con datos de ECG, EMG o EEG." },
    { icon: Cpu, title: "Procesar", desc: "El sistema aplica filtros, normalización y detección de forma automática." },
    { icon: LineChart, title: "Visualizar", desc: "Explora gráficos interactivos y métricas calculadas en tiempo real." },
    { icon: Lightbulb, title: "Aprender", desc: "Recibe explicaciones pedagógicas paso a paso del asistente educativo." },
  ];
  return (
    <section id="como-funciona" className="bg-gradient-soft py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="Cómo funciona"
          title="De la señal cruda al aprendizaje en 4 pasos"
        />
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-border bg-card p-7 shadow-card">
              <div className="absolute -top-3 left-7 rounded-full bg-gradient-brand px-3 py-0.5 text-xs font-bold text-primary-foreground shadow-glow">
                Paso {i + 1}
              </div>
              <s.icon className="h-7 w-7 text-primary" />
              <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchitectureSection() {
  const [activeBlock, setActiveBlock] = useState(0);

  const blocks = [
    {
      name: "Usuario",
      description: "Estudiante o docente interactúa con la plataforma para cargar señales y explorar resultados.",
      technology: "Experiencia web guiada",
      icon: UserRound,
    },
    {
      name: "Frontend React",
      description: "La interfaz reúne laboratorios, visualizaciones interactivas y componentes pedagógicos para el usuario.",
      technology: "React + TypeScript",
      icon: Activity,
    },
    {
      name: "Backend FastAPI",
      description: "Orquesta la lógica de negocio, expone servicios y prepara los datos para el análisis.",
      technology: "FastAPI",
      icon: Cpu,
    },
    {
      name: "Procesamiento de Bioseñales",
      description: "Aplica filtrado, extracción de características y procesamiento digital de señales fisiológicas.",
      technology: "NumPy, SciPy, NeuroKit2, MNE",
      icon: Filter,
    },
    {
      name: "Módulo Inteligente",
      description: "Clasifica patrones, estima estados y genera explicaciones automáticas con aprendizaje automático.",
      technology: "Scikit-Learn y TensorFlow",
      icon: Bot,
    },
    {
      name: "Visualización de Resultados",
      description: "Transforma los resultados en gráficos interactivos y métricas comprensibles para el usuario.",
      technology: "Plotly",
      icon: LineChart,
    },
    {
      name: "Retroalimentación Educativa",
      description: "Integra explicaciones, guías y contexto pedagógico para reforzar el aprendizaje.",
      technology: "Retroalimentación guiada y asistente",
      icon: GraduationCap,
    },
  ];

  const ActiveIcon = blocks[activeBlock].icon;

  return (
    <section id="arquitectura" className="bg-gradient-soft py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader
          eyebrow="Arquitectura de EduSignal"
          title="Flujo completo de la plataforma"
          desc="Una arquitectura modular que conecta la experiencia de usuario, el procesamiento de bioseñales y la inteligencia artificial en un entorno educativo coherente."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2rem] border border-border bg-card p-6 shadow-card">
            <div className="flex flex-col gap-4">
              {blocks.map((block, index) => {
                const Icon = block.icon;
                const isActive = activeBlock === index;
                return (
                  <div key={block.name} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveBlock(index)}
                      className={`flex-1 rounded-2xl border px-4 py-4 text-left transition ${
                        isActive
                          ? "border-primary/40 bg-primary/8 shadow-sm"
                          : "border-border/70 bg-background/70 hover:border-primary/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`grid h-10 w-10 place-items-center rounded-xl ${isActive ? "bg-gradient-brand text-primary-foreground" : "bg-accent text-primary"}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-display text-base font-semibold">{block.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{block.technology}</p>
                        </div>
                      </div>
                    </button>
                    {index < blocks.length - 1 ? <ArrowDown className="h-4 w-4 text-muted-foreground" /> : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2rem] border border-border bg-background/80 p-6 shadow-card">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-glow">
                <ActiveIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Bloque activo</p>
                <h3 className="font-display text-xl font-semibold">{blocks[activeBlock].name}</h3>
              </div>
            </div>

            <p className="mt-6 text-base leading-7 text-muted-foreground">{blocks[activeBlock].description}</p>

            <div className="mt-6 rounded-2xl border border-border/70 bg-card/80 p-4">
              <p className="text-sm font-semibold text-foreground">Tecnología utilizada</p>
              <p className="mt-2 text-sm text-muted-foreground">{blocks[activeBlock].technology}</p>
            </div>

            <div className="mt-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/8 to-transparent p-4">
              <p className="text-sm font-semibold text-foreground">Flujo general</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Usuario → Frontend → Backend → Procesamiento → Inteligencia Artificial → Visualización → Retroalimentación.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  const items = [
    {
      icon: GraduationCap,
      title: "Aprendizaje práctico",
      desc: "Experimenta con señales reales en lugar de solo leer teoría.",
    },
    {
      icon: ShieldCheck,
      title: "Reduce barreras técnicas",
      desc: "Sin instalar MATLAB ni programar: todo desde el navegador.",
    },
    {
      icon: Eye,
      title: "Interpretación sencilla",
      desc: "Explicaciones pedagógicas integradas en cada visualización.",
    },
    {
      icon: Microscope,
      title: "Apoyo en laboratorios",
      desc: "Complementa cursos presenciales con prácticas virtuales guiadas.",
    },
  ];
  return (
    <section id="beneficios" className="py-24">
      <div className="mx-auto max-w-7xl px-6">
        <SectionHeader eyebrow="Beneficios" title="Diseñada para enseñar, pensada para aprender" />
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {items.map((b) => (
            <div key={b.title} className="rounded-2xl border border-border bg-card p-6 text-center shadow-card">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-glow">
                <b.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contacto" className="relative overflow-hidden bg-gradient-hero py-24 text-white">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur">
          <Mail className="h-3.5 w-3.5 text-teal" />
          Contacto
        </div>
        <h2 className="mt-6 text-3xl font-bold tracking-tight md:text-5xl">
          Lleva EduSignal a tu aula
        </h2>
        <p className="mt-4 text-lg text-white/70">
          ¿Eres docente, estudiante o investigador? Cuéntanos cómo te gustaría usar la plataforma
          en tu institución.
        </p>
        <form className="mx-auto mt-10 flex max-w-xl flex-col gap-3 sm:flex-row">
          <input
            type="email"
            required
            placeholder="tu@universidad.edu"
            className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none backdrop-blur focus:border-teal"
          />
          <Button
            type="submit"
            size="lg"
            className="bg-gradient-brand text-primary-foreground shadow-glow hover:opacity-95"
          >
            Solicitar acceso
          </Button>
        </form>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <div>
          <Logo />
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Laboratorio virtual educativo para el aprendizaje de procesamiento digital de bioseñales.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground md:items-end">
          <div className="flex gap-6">
            <a href="#acerca" className="hover:text-foreground">Acerca</a>
            <a href="#caracteristicas" className="hover:text-foreground">Características</a>
            <a href="#contacto" className="hover:text-foreground">Contacto</a>
          </div>
          <div>© {new Date().getFullYear()} EduSignal. Todos los derechos reservados.</div>
        </div>
      </div>
    </footer>
  );
}
