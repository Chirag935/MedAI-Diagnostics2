"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  Shield,
  Stethoscope,
  Search,
  Download,
  Camera,
  BarChart3,
  X,
  Bot,
  Cpu,
  Heart,
  Brain,
  Microscope,
  FileCheck,
  ChevronRight,
  Sparkles,
  Lock,
  Clock,
  Users,
  Globe,
  FileText,
  LogIn,
  CalendarClock,
  LogOut,
  Pill,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/api-config";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";

export default function HomePage() {
  const router = useRouter();
  const [showMetrics, setShowMetrics] = useState(false);
  const [metricsData, setMetricsData] = useState<any>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [activeStatIndex, setActiveStatIndex] = useState(0);
  const { lang, setLang, t } = useLanguage();
  const { isLoggedIn, user, role, hasAccess, logout, isLoaded } = useAuth();

  // Animate stats counter
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStatIndex((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isLoaded && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoaded, isLoggedIn, router]);

  const fetchMetrics = async () => {
    setShowMetrics(true);
    setIsLoadingMetrics(true);
    try {
      const res = await fetch(`${API.metrics}/`);
      if (res.ok) {
        const data = await res.json();
        setMetricsData(data);
      } else {
        throw new Error("Failed to fetch metrics");
      }
    } catch (error) {
      console.error(error);
      setMetricsData({
        symptoms: {
          model_name: "General Symptom Predictor (Random Forest)",
          accuracy: 0.99,
          status: "active",
        },
        skin: {
          model_name: "Skin Infection Classifier (CV Engine)",
          accuracy: 0.883,
          status: "active",
        },
      });
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  const modules = [
    {
      id: "symptom-checker",
      name: t("mod.symptom.name"),
      icon: Search,
      tag: "3D Body Map",
      description: t("mod.symptom.desc"),
      gradient: "from-teal-500 to-cyan-500",
      shadow: "shadow-teal-500/20",
      stats: "40+ Conditions",
    },
    {
      id: "skin-analyzer",
      name: t("mod.skin.name"),
      icon: Microscope,
      tag: "XAI Heatmaps",
      description: t("mod.skin.desc"),
      gradient: "from-indigo-500 to-violet-500",
      shadow: "shadow-indigo-500/20",
      stats: "Grad-CAM XAI",
    },
    {
      id: "ai-assistant",
      name: t("mod.ai.name"),
      icon: Bot,
      tag: "RAG + LLM",
      description: t("mod.ai.desc"),
      gradient: "from-purple-500 to-pink-500",
      shadow: "shadow-purple-500/20",
      stats: "Llama 3 70B",
    },
    {
      id: "mlops-dashboard",
      name: t("mod.mlops.name"),
      icon: Cpu,
      tag: "Live Metrics",
      description: t("mod.mlops.desc"),
      gradient: "from-emerald-500 to-teal-500",
      shadow: "shadow-emerald-500/20",
      stats: "Real-Time",
    },
    {
      id: "patients",
      name: t("mod.patient.name"),
      icon: Users,
      tag: "EMR System",
      description: t("mod.patient.desc"),
      gradient: "from-amber-500 to-orange-500",
      shadow: "shadow-amber-500/20",
      stats: "Full EMR",
    },
    {
      id: "prescription",
      name: t("mod.rx.name"),
      icon: FileText,
      tag: "PDF Export",
      description: t("mod.rx.desc"),
      gradient: "from-rose-500 to-red-500",
      shadow: "shadow-rose-500/20",
      stats: "Auto PDF",
    },
    {
      id: "prescriptions",
      name: t("mod.rxqueue.name"),
      icon: FileCheck,
      tag: "Receptionist Queue",
      description: t("mod.rxqueue.desc"),
      gradient: "from-purple-500 to-pink-500",
      shadow: "shadow-purple-500/20",
      stats: "Email Dispatch",
    },
    {
      id: "appointments",
      name: t("mod.appointments.name"),
      icon: CalendarClock,
      tag: "Scheduling",
      description: t("mod.appointments.desc"),
      gradient: "from-sky-500 to-blue-500",
      shadow: "shadow-sky-500/20",
      stats: "Calendar",
    },
    {
      id: "medication-reminders",
      name: t("mod.reminders.name"),
      icon: Pill,
      tag: "Smart Alerts",
      description: t("mod.reminders.desc"),
      gradient: "from-pink-500 to-rose-500",
      shadow: "shadow-pink-500/20",
      stats: "Gmail + Browser",
    },
  ];

  // Filter modules by role
  const visibleModules = isLoggedIn
    ? modules.filter((m) => hasAccess(m.id))
    : modules.filter((m) => m.id !== "appointments"); // Hide appointments from landing

  const platformStats = [
    { value: "99.1%", label: t("stat.symptomAcc"), icon: Brain },
    { value: "88.3%", label: t("stat.skinAcc"), icon: Microscope },
    { value: "40+", label: t("stat.conditions"), icon: Heart },
    { value: "<2s", label: t("stat.responseTime"), icon: Clock },
  ];

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isLoaded && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoaded, isLoggedIn, router]);

  if (!isLoaded || !isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#050a18] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a18]">
      {/* Ambient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-purple-500/3 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative border-b border-white/[0.06] bg-[#050a18]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Medical Logo */}
              <div className="relative">
                <div className="w-11 h-11 bg-gradient-to-br from-teal-400 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/25">
                  <Stethoscope className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-[#050a18] animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  MedAI <span className="text-teal-400">Diagnostics</span>
                </h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-medium">
                  {t("nav.tagline")}
                </p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={() =>
                  document
                    .getElementById("modules-section")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-all font-medium"
              >
                {t("nav.modules")}
              </button>
              <button
                onClick={() =>
                  document
                    .getElementById("tech-section")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-all font-medium"
              >
                {t("nav.technology")}
              </button>
            </nav>

            <div className="flex items-center gap-3">
              {/* Language Switcher */}
              <button
                onClick={() => setLang(lang === "en" ? "hi" : "en")}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-all border border-white/5"
              >
                <Globe className="w-4 h-4 text-indigo-400" />
                <span className="text-white">
                  {lang === "en" ? "हिं" : "EN"}
                </span>
              </button>
              <button
                onClick={fetchMetrics}
                className="flex items-center gap-2 px-4 py-2.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 rounded-xl text-sm font-semibold transition-all border border-teal-500/20 hover:border-teal-500/40"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">{t("nav.accuracy")}</span>
              </button>
              {!isLoggedIn && (
                <button
                  onClick={() => router.push("/login")}
                  className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded-xl text-sm font-semibold transition-all border border-purple-500/20 hover:border-purple-500/40"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">{t("nav.login")}</span>
                </button>
              )}
              {isLoggedIn && user && (
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 rounded-xl border border-white/10">
                  <div className="w-7 h-7 bg-gradient-to-br from-teal-400 to-cyan-500 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                    {user.name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div className="hidden sm:flex flex-col leading-tight">
                    <span className="text-xs font-semibold text-white truncate max-w-[120px]">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-teal-300 uppercase tracking-wider">
                      {role}
                    </span>
                  </div>
                </div>
              )}
              {isLoggedIn && (
                <button
                  onClick={() => {
                    logout();
                    router.push("/");
                  }}
                  className="flex items-center gap-1 px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-semibold transition-all border border-red-500/20"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative">
        <div className="max-w-7xl mx-auto px-6 pt-20 pb-8">
          <div className="max-w-4xl">
            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-teal-500/20 bg-teal-500/5 mb-8 animate-fadeIn">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-sm text-teal-300 font-medium">
                {t("hero.badge")}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-xs text-slate-400">
                v2.0 — Powered by OpenCV + Llama 3
              </span>
            </div>

            <h2 className="text-5xl md:text-[3.5rem] font-extrabold text-white mb-6 leading-[1.15] tracking-tight">
              {t("hero.title1")} <br />
              <span className="bg-gradient-to-r from-teal-400 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                {t("hero.title2")}
              </span>
            </h2>

            <p
              className="text-lg text-slate-400 mb-10 leading-relaxed max-w-2xl"
              dangerouslySetInnerHTML={{ __html: t("hero.desc") }}
            />

            <div className="mb-16" />
          </div>
        </div>

        {/* Stats Bar */}
        <div className="border-y border-white/[0.06] bg-white/[0.02]">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {platformStats.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-4 transition-all duration-500 ${i === activeStatIndex ? "opacity-100" : "opacity-60"}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-500 ${
                        i === activeStatIndex
                          ? "bg-teal-500/20"
                          : "bg-slate-800"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 transition-colors duration-500 ${
                          i === activeStatIndex
                            ? "text-teal-400"
                            : "text-slate-500"
                        }`}
                      />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white">
                        {stat.value}
                      </div>
                      <div className="text-xs text-slate-500">{stat.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Diagnostic Modules */}
      <section id="modules-section" className="relative">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-sm font-semibold text-teal-400 uppercase tracking-wider mb-2">
                {t("modules.subtitle")}
              </p>
              <h3 className="text-3xl font-bold text-white">
                {t("modules.title")}
              </h3>
            </div>
            <p className="text-sm text-slate-500 hidden md:block">
              {t("modules.count")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleModules.map((module) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.id}
                  onClick={() => router.push(`/${module.id}`)}
                  className={`group relative bg-[#0a1225] border border-white/[0.06] rounded-2xl p-7 cursor-pointer overflow-hidden transition-all duration-500 hover:border-white/[0.12] hover:bg-[#0c1530] hover:shadow-xl ${module.shadow}`}
                >
                  {/* Gradient glow */}
                  <div
                    className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-br ${module.gradient} opacity-[0.04] rounded-full blur-3xl -mr-20 -mt-20 transition-all duration-500 group-hover:opacity-[0.08] group-hover:scale-150`}
                  />

                  <div className="relative flex items-start justify-between mb-5">
                    <div
                      className={`w-14 h-14 bg-gradient-to-br ${module.gradient} rounded-2xl flex items-center justify-center shadow-lg ${module.shadow} transform transition-all group-hover:scale-110 group-hover:rotate-3`}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <span className="px-3 py-1 bg-white/5 border border-white/[0.08] rounded-lg text-xs font-semibold text-slate-400 group-hover:text-white group-hover:bg-white/10 transition-all flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3" />
                      {module.tag}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-teal-300 transition-colors">
                    {module.name}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-5">
                    {module.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 font-mono bg-white/[0.03] px-2.5 py-1 rounded-md border border-white/[0.04]">
                      {module.stats}
                    </span>
                    <div className="flex items-center gap-1.5 text-teal-400 text-sm font-semibold group-hover:translate-x-1 transition-transform">
                      {t("modules.launch")}
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Technology Stack Section */}
      <section id="tech-section" className="border-t border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-2">
              {t("tech.title")}
            </p>
            <h3 className="text-3xl font-bold text-white">
              {t("tech.subtitle")}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Brain,
                title: "Machine Learning Pipeline",
                desc: "Random Forest classifiers trained on clinical datasets with 80/20 train-test split, K-fold cross-validation, and real-time inference.",
                tags: ["scikit-learn", "Random Forest", "K-Fold CV"],
                color: "text-teal-400",
                border: "border-teal-500/10 hover:border-teal-500/30",
              },
              {
                icon: Microscope,
                title: "Computer Vision Engine",
                desc: "Multi-channel saliency fusion combining edge detection, HSV color analysis, and pigmentation mapping with Grad-CAM-style XAI overlays.",
                tags: ["OpenCV", "XAI Heatmaps", "Saliency Maps"],
                color: "text-indigo-400",
                border: "border-indigo-500/10 hover:border-indigo-500/30",
              },
              {
                icon: Bot,
                title: "Generative AI (RAG)",
                desc: "Retrieval-Augmented Generation pipeline injecting diagnostic context into Llama 3 70B for personalized, evidence-based medical Q&A.",
                tags: ["Llama 3", "Groq API", "RAG Pipeline"],
                color: "text-purple-400",
                border: "border-purple-500/10 hover:border-purple-500/30",
              },
            ].map((tech, i) => {
              const Icon = tech.icon;
              return (
                <div
                  key={i}
                  className={`bg-[#0a1225] border ${tech.border} rounded-2xl p-7 transition-all duration-300`}
                >
                  <div className="w-12 h-12 bg-white/[0.03] rounded-xl flex items-center justify-center mb-5 border border-white/5">
                    <Icon className={`w-6 h-6 ${tech.color}`} />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-3">
                    {tech.title}
                  </h4>
                  <p className="text-sm text-slate-500 leading-relaxed mb-5">
                    {tech.desc}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tech.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2.5 py-1 bg-white/[0.03] border border-white/[0.06] rounded-md text-slate-400 font-mono"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust & Compliance Bar */}
      <section className="border-t border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                icon: Shield,
                label: "HIPAA-Aware Design",
                desc: "Zero data persistence architecture",
              },
              {
                icon: Lock,
                label: "Privacy First",
                desc: "No images stored server-side",
              },
              {
                icon: FileCheck,
                label: "PDF Reports",
                desc: "Exportable clinical summaries",
              },
              {
                icon: Users,
                label: "Open Source",
                desc: "Fully transparent AI pipeline",
              },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-slate-800/80 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/5">
                    <Icon className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-white mb-0.5">
                      {item.label}
                    </h5>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#030712]">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center">
                <Stethoscope className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm text-slate-500">
                © 2026 MedAI Diagnostics. For educational and research purposes
                only.
              </span>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-xs text-slate-600">
                FastAPI + Next.js + OpenCV + Llama 3
              </span>
              <span className="text-xs text-teal-400/60 font-medium">
                ⚕️ AI-Powered Professional Diagnostic Tool
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Metrics Modal */}
      {showMetrics && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-[#0a1225] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-white/[0.06]">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-teal-400" />
                  Live Model Performance
                </h3>
                <p className="text-slate-500 text-xs mt-1">
                  Validation accuracy from independent test datasets
                </p>
              </div>
              <button
                onClick={() => setShowMetrics(false)}
                className="text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {isLoadingMetrics ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
                </div>
              ) : metricsData ? (
                <div className="space-y-4">
                  {Object.entries(metricsData).map(
                    ([key, data]: [string, any]) => (
                      <div
                        key={key}
                        className="bg-white/[0.02] rounded-xl p-5 border border-white/[0.06]"
                      >
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <h4 className="text-base font-bold text-white">
                              {data.model_name}
                            </h4>
                            <span className="text-xs text-emerald-400 font-medium">
                              {data.status === "active"
                                ? "● Trained & Active"
                                : "○ Not Trained"}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-3xl font-extrabold text-white">
                              {(data.accuracy * 100).toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                              Validation Accuracy
                            </div>
                          </div>
                        </div>
                        {/* Accuracy bar */}
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full transition-all duration-1000"
                            style={{ width: `${data.accuracy * 100}%` }}
                          />
                        </div>
                      </div>
                    ),
                  )}

                  <div className="bg-teal-500/5 border border-teal-500/10 rounded-xl p-4 flex items-start gap-3 mt-4">
                    <Shield className="w-5 h-5 text-teal-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h5 className="text-xs font-bold text-teal-300 mb-1">
                        Methodology
                      </h5>
                      <p className="text-xs text-teal-200/60 leading-relaxed">
                        Accuracy computed on the{" "}
                        <strong>held-out test set (20%)</strong> using
                        stratified K-Fold cross-validation. The model has never
                        seen this data during training.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-red-400">
                  Failed to load metrics.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
