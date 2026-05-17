"use client";

import { useState, useEffect, useCallback } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

// ─── TYPES ───────────────────────────────────────────────────────────────────
type Category = "Reach" | "Target" | "Safety" | "Hidden Gem";
type Page = "landing" | "quiz" | "loading" | "results";

type Profile = {
  gpa: string;
  major: string;
  income: string;
  firstGen: string;
  state: string;
  extracurricular: string;
  leadership: string;
  region: string;
  size: string;
  setting: string;
  career: number;
  affordability: number;
  food: number;
  gym: number;
  study: number;
  social: number;
  academicRep: number;
};

type College = {
  id: number | string;
  name: string;
  acceptRate?: number;
  tuition?: number;
};

type Scores = {
  matchScore: number;
  academicFit: number;
  financialFit: number;
  lifestyleFit: number;
  careerFit: number;
  category: Category;
};

type Match = {
  college: College;
  scores: Scores;
  reasoning?: string;
};

type Results = {
  matches: Match[];
  profile: Profile;
};

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const STEPS: readonly string[] = ["Academic", "Background", "Preferences", "Priorities"];
const REGIONS: readonly string[] = ["California", "West Coast", "East Coast", "South", "Midwest", "Anywhere"];
const SIZES: readonly string[] = ["Small", "Medium", "Large", "No preference"];
const SETTINGS: readonly string[] = ["Urban", "Suburban", "College Town", "No preference"];
const LOADING_MSGS: readonly string[] = [
  "Analyzing academic competitiveness...",
  "Calculating lifestyle compatibility...",
  "Evaluating financial fit...",
  "Finding hidden gem schools...",
  "Generating personalized insights...",
];

// ─── COLOR HELPERS ───────────────────────────────────────────────────────────
const catColor: Record<Category, string> = {
  Reach: "#ef4444",
  Target: "#3b82f6",
  Safety: "#10b981",
  "Hidden Gem": "#a855f7",
};
const catBg: Record<Category, string> = {
  Reach: "rgba(239,68,68,0.12)",
  Target: "rgba(59,130,246,0.12)",
  Safety: "rgba(16,185,129,0.12)",
  "Hidden Gem": "rgba(168,85,247,0.12)",
};

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

type NavBarProps = { page: Page; setPage: (p: Page) => void };
function NavBar({ page, setPage }: NavBarProps) {
  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(8,8,20,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setPage("landing")}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#fff" }}>S</div>
        <span style={{ fontFamily: "'Clash Display',system-ui", fontWeight: 700, fontSize: 18, color: "#fff", letterSpacing: "-0.03em" }}>Scholr</span>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {page === "landing" && (
          <button onClick={() => setPage("quiz")} style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", border: "none", borderRadius: 20, padding: "8px 20px", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", letterSpacing: "0.01em" }}>
            Start Matching →
          </button>
        )}
      </div>
    </nav>
  );
}

type ScoreRingProps = { score: number; size?: number; stroke?: number; color?: string };
function ScoreRing({ score, size = 72, stroke = 7, color = "#6366f1" }: ScoreRingProps) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 1s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.22, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: size * 0.11, color: "rgba(255,255,255,0.5)", lineHeight: 1, marginTop: 2 }}>/ 100</span>
      </div>
    </div>
  );
}

type BarProps = { pct: number; color?: string; label: string; value: number };
function Bar({ pct, color = "#6366f1", label, value }: BarProps) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>
        <span>{label}</span><span style={{ color: "#fff", fontWeight: 600 }}>{value}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: color, transition: "width 1s ease" }} />
      </div>
    </div>
  );
}

type CollegeCardProps = {
  match: Match;
  profile: Profile;
  expanded: boolean;
  onToggle: () => void;
};
function CollegeCard({ match, profile, expanded, onToggle }: CollegeCardProps) {
  const { college, scores, reasoning } = match;
  const feeWaiver = ["Under $40k", "$40k–$80k"].includes(profile.income);
  return (
    <div
      onClick={onToggle}
      style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20,
        padding: 20, cursor: "pointer", transition: "all 0.25s",
        boxShadow: expanded ? "0 0 0 2px " + catColor[scores.category] + "55" : "none",
      }}
      onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ScoreRing score={scores.matchScore} size={64} color={catColor[scores.category]} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{college.name}</span>
            <span style={{ background: catBg[scores.category], color: catColor[scores.category], border: `1px solid ${catColor[scores.category]}44`, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}>
              {scores.category.toUpperCase()}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {([
              ["Academic", scores.academicFit, "#6366f1"],
              ["Financial", scores.financialFit, "#10b981"],
              ["Lifestyle", scores.lifestyleFit, "#f59e0b"],
              ["Career", scores.careerFit, "#a855f7"],
            ] as const).map(([l, v, c]) => (
              <span key={l} style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                <span style={{ color: c, fontWeight: 700 }}>{v}%</span> {l}
              </span>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 18 }}>{expanded ? "▲" : "▼"}</div>
      </div>
      {expanded && (
        <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            <Bar pct={scores.academicFit} value={scores.academicFit} label="Academic Fit" color="#6366f1" />
            <Bar pct={scores.financialFit} value={scores.financialFit} label="Financial Fit" color="#10b981" />
            <Bar pct={scores.lifestyleFit} value={scores.lifestyleFit} label="Lifestyle Fit" color="#f59e0b" />
            <Bar pct={scores.careerFit} value={scores.careerFit} label="Career Fit" color="#a855f7" />
          </div>
          {reasoning && (
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 13, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, borderLeft: `3px solid ${catColor[scores.category]}` }}>
              {reasoning}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {college.tuition != null && (
              <span style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                Est. cost: ${(college.tuition / 1000).toFixed(0)}k/yr
              </span>
            )}
            {college.acceptRate != null && (
              <span style={{ background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                Accept rate: {college.acceptRate}%
              </span>
            )}
            {feeWaiver && (
              <span style={{ background: "rgba(16,185,129,0.12)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#10b981" }}>
                ✓ Fee waiver likely eligible
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LANDING PAGE ─────────────────────────────────────────────────────────────
type LandingPageProps = { setPage: (p: Page) => void };
function LandingPage({ setPage }: LandingPageProps) {
  const features = [
    { icon: "", title: "Personalized Match Scores", desc: "Every college ranked by how well it fits your unique academic and personal profile." },
    { icon: "", title: "Reach / Target / Safety", desc: "Smart categorization so you build a balanced, strategic application list." },
    { icon: "", title: "Financial Fit Insights", desc: "See which schools align with your household income and aid eligibility." },
    { icon: "", title: "Lifestyle-Based Matching", desc: "Campus setting, size, social scene, food, and gym — it all matters." },
    { icon: "", title: "AI-Style Explanations", desc: "Plain-English reasoning for every match, not just a number." },
  ];
  const steps = [
    { n: "01", title: "Tell us about yourself", desc: "Share your GPA, major interests, budget, and campus preferences in a 2-minute form." },
    { n: "02", title: "Get personalized recommendations", desc: "Our engine scores every school against your unique profile across 4 dimensions." },
    { n: "03", title: "Build a smarter college list", desc: "See Reach, Target, Safety & Hidden Gems — with reasoning you can actually act on." },
  ];
  return (
    <div style={{ background: "#080814", minHeight: "100vh", paddingTop: 60, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ position: "fixed", top: -200, left: "50%", transform: "translateX(-50%)", width: 900, height: 600, background: "radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", top: 300, left: -200, width: 500, height: 400, background: "radial-gradient(ellipse, rgba(168,85,247,0.12) 0%, transparent 65%)", pointerEvents: "none" }} />

      <section style={{ maxWidth: 900, margin: "0 auto", padding: "100px 24px 60px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 20, padding: "6px 14px", marginBottom: 24, fontSize: 12, color: "#a5b4fc", fontWeight: 600, letterSpacing: "0.08em" }}>
          ✦ COLLEGE MATCHING, REIMAGINED
        </div>
        <h1 style={{ fontSize: "clamp(40px,7vw,80px)", fontWeight: 800, color: "#fff", margin: "0 0 20px", lineHeight: 1.08, letterSpacing: "-0.04em" }}>
          Find colleges that<br />
          <span style={{ background: "linear-gradient(135deg,#6366f1,#a855f7,#ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>actually fit you.</span>
        </h1>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.55)", maxWidth: 560, margin: "0 auto 40px", lineHeight: 1.7 }}>
          Scholr helps students discover realistic colleges based on academics, finances, career goals, and campus lifestyle.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setPage("quiz")} style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", border: "none", borderRadius: 14, padding: "14px 32px", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 8px 32px rgba(99,102,241,0.4)", letterSpacing: "0.01em" }}>
            Start Matching →
          </button>
        </div>
        <div style={{ marginTop: 60, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 24, maxWidth: 620, margin: "60px auto 0", textAlign: "left" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {["#ef4444","#f59e0b","#10b981"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[{ name: "UC Irvine", score: 91, cat: "Target", color: "#3b82f6" }, { name: "Cal Poly SLO", score: 87, cat: "Hidden Gem", color: "#a855f7" }, { name: "Stanford", score: 54, cat: "Reach", color: "#ef4444" }].map(s => (
              <div key={s.name} style={{ flex: 1, minWidth: 150, background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: 14, border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: 11, color: s.color, fontWeight: 700, marginBottom: 4 }}>{s.cat}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{s.name}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.score}<span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>/100</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "80px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 36, fontWeight: 800, color: "#fff", marginBottom: 12, letterSpacing: "-0.03em" }}>Everything you need to decide smarter</h2>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.45)", marginBottom: 48, fontSize: 16 }}>Not a ranking. Not a lottery. A genuine fit score.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
          {features.map(f => (
            <div key={f.title} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 22 }}>
              <div style={{ fontSize: 26, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px 80px" }}>
        <h2 style={{ textAlign: "center", fontSize: 36, fontWeight: 800, color: "#fff", marginBottom: 48, letterSpacing: "-0.03em" }}>How it works</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: 22 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#6366f1", opacity: 0.5, lineHeight: 1, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{s.n}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.65 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px 80px" }}>
        <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 24, padding: "40px 32px" }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 12, letterSpacing: "-0.03em" }}>How Scholr Scales</h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 24 }}>
            Scholr&apos;s initial monetization strategy focuses on high-intent student traffic through educational advertising while validating user demand and engagement.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            {["Ad-supported platform", "Organic student referrals", "SEO-driven college search", "Future premium features"].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
                <span style={{ color: "#6366f1" }}>✓</span> {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "24px", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: "linear-gradient(135deg,#6366f1,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>S</div>
          <span style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>Scholr</span>
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", maxWidth: 500, margin: "0 auto" }}>
          Scholr does not guarantee admissions outcomes. Recommendations are based on estimated competitiveness and fit factors.
        </p>
      </footer>
    </div>
  );
}

// ─── QUIZ ─────────────────────────────────────────────────────────────────────
const defaultProfile: Profile = {
  gpa: "", major: "", income: "", firstGen: "", state: "",
  extracurricular: "", leadership: "", region: "California",
  size: "No preference", setting: "No preference",
  career: 3, affordability: 3, food: 3, gym: 3, study: 3, social: 3, academicRep: 3,
};

type ChipProps = { label: string; active: boolean; onClick: () => void };
function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button onClick={onClick} style={{
      background: active ? "linear-gradient(135deg,#6366f1,#a855f7)" : "rgba(255,255,255,0.05)",
      border: active ? "1px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10, padding: "8px 16px", color: active ? "#fff" : "rgba(255,255,255,0.6)",
      fontWeight: active ? 700 : 500, fontSize: 13, cursor: "pointer", transition: "all 0.15s",
    }}>
      {label}
    </button>
  );
}

type SliderProps = { label: string; value: number; onChange: (n: number) => void };
function Slider({ label, value, onChange }: SliderProps) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#a5b4fc" }}>{value}/5</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <div key={n} onClick={() => onChange(n)} style={{
            flex: 1, height: 8, borderRadius: 999, cursor: "pointer", transition: "all 0.15s",
            background: n <= value ? "linear-gradient(90deg,#6366f1,#a855f7)" : "rgba(255,255,255,0.1)",
          }} />
        ))}
      </div>
    </div>
  );
}

type QuizPageProps = {
  setPage: (p: Page) => void;
  setProfile: (p: Profile) => void;
};
function QuizPage({ setPage, setProfile: setAppProfile }: QuizPageProps) {
  const [step, setStep] = useState<number>(0);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) =>
    setProfile(p => ({ ...p, [k]: v }));

  const sliderKeys: [keyof Profile, string][] = [
    ["career", "Career Outcomes"],
    ["affordability", "Affordability"],
    ["food", "Food Quality"],
    ["gym", "Gym / Recreation"],
    ["study", "Study Environment"],
    ["social", "Social Life"],
    ["academicRep", "Academic Reputation"],
  ];

  const stepsContent = [
    <div key={0}>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Your academic profile</h2>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 28 }}>We&apos;ll use this to estimate your competitiveness at each school.</p>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 6 }}>GPA (Unweighted)</label>
        <input value={profile.gpa} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("gpa", e.target.value)} placeholder="e.g. 3.7"
          style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 16px", color: "#fff", fontSize: 15, outline: "none" }} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 6 }}>Intended Major</label>
        <input value={profile.major} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("major", e.target.value)} placeholder="e.g. Computer Science"
          style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 16px", color: "#fff", fontSize: 15, outline: "none" }} />
      </div>
      <div>
        <label style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 10 }}>Extracurricular Strength</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Low", "Medium", "High"].map(v => <Chip key={v} label={v} active={profile.extracurricular === v} onClick={() => set("extracurricular", v)} />)}
        </div>
      </div>
      <div style={{ marginTop: 20 }}>
        <label style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 10 }}>Leadership Strength</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Low", "Medium", "High"].map(v => <Chip key={v} label={v} active={profile.leadership === v} onClick={() => set("leadership", v)} />)}
        </div>
      </div>
    </div>,

    <div key={1}>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Your background</h2>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 28 }}>Financial and personal context shapes your best-fit schools.</p>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 10 }}>Household Income</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Under $40k", "$40k–$80k", "$80k–$120k", "$120k–$160k", "$160k+"].map(v => <Chip key={v} label={v} active={profile.income === v} onClick={() => set("income", v)} />)}
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 10 }}>First-Generation Student?</label>
        <div style={{ display: "flex", gap: 8 }}>
          {["Yes", "No"].map(v => <Chip key={v} label={v} active={profile.firstGen === v} onClick={() => set("firstGen", v)} />)}
        </div>
      </div>
      <div>
        <label style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 6 }}>Your State</label>
        <input value={profile.state} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("state", e.target.value)} placeholder="e.g. California"
          style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 16px", color: "#fff", fontSize: 15, outline: "none" }} />
      </div>
    </div>,

    <div key={2}>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Campus preferences</h2>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 28 }}>Tell us what kind of environment you thrive in.</p>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 10 }}>Preferred Region</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {REGIONS.map(v => <Chip key={v} label={v} active={profile.region === v} onClick={() => set("region", v)} />)}
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 10 }}>School Size</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SIZES.map(v => <Chip key={v} label={v} active={profile.size === v} onClick={() => set("size", v)} />)}
        </div>
      </div>
      <div>
        <label style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", display: "block", marginBottom: 10 }}>Campus Setting</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {SETTINGS.map(v => <Chip key={v} label={v} active={profile.setting === v} onClick={() => set("setting", v)} />)}
        </div>
      </div>
    </div>,

    <div key={3}>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 6 }}>What matters most?</h2>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 28 }}>Rate each factor from 1 (low) to 5 (essential).</p>
      {sliderKeys.map(([k, l]) => (
        <Slider key={k as string} label={l} value={profile[k] as number} onChange={(v: number) => set(k, v as Profile[typeof k])} />
      ))}
    </div>,
  ];

  const canAdvance = (): boolean => {
    if (step === 0) return Boolean(profile.gpa && profile.major && profile.extracurricular && profile.leadership);
    if (step === 1) return Boolean(profile.income && profile.firstGen);
    return true;
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      setAppProfile(profile);
      setPage("loading");
    }
  };

  return (
    <div style={{ background: "#080814", minHeight: "100vh", paddingTop: 60, fontFamily: "'DM Sans', system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ position: "fixed", top: -100, left: "50%", transform: "translateX(-50%)", width: 700, height: 400, background: "radial-gradient(ellipse, rgba(99,102,241,0.15) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ width: "100%", maxWidth: 580, padding: "40px 24px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 40 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ flex: 1 }}>
              <div style={{ height: 4, borderRadius: 999, background: i <= step ? "linear-gradient(90deg,#6366f1,#a855f7)" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
              <div style={{ fontSize: 10, color: i === step ? "#a5b4fc" : "rgba(255,255,255,0.3)", marginTop: 6, fontWeight: i === step ? 700 : 400 }}>{s}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: 28, marginBottom: 20 }}>
          {stepsContent[step]}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: "14px", color: "rgba(255,255,255,0.7)", fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
              ← Back
            </button>
          )}
          <button onClick={handleNext} disabled={!canAdvance()} style={{
            flex: 2, background: canAdvance() ? "linear-gradient(135deg,#6366f1,#a855f7)" : "rgba(255,255,255,0.08)",
            border: "none", borderRadius: 14, padding: "14px", color: canAdvance() ? "#fff" : "rgba(255,255,255,0.3)",
            fontWeight: 700, fontSize: 15, cursor: canAdvance() ? "pointer" : "not-allowed", transition: "all 0.2s",
          }}>
            {step < STEPS.length - 1 ? "Continue →" : "Find My Matches "}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LOADING PAGE ─────────────────────────────────────────────────────────────
type LoadingPageProps = {
  setPage: (p: Page) => void;
  profile: Profile | null;
  setResults: (r: Results) => void;
};
function LoadingPage({ setPage, profile, setResults }: LoadingPageProps) {
  const [msgIdx, setMsgIdx] = useState<number>(0);
  const [prog, setProg] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!profile) {
      setPage("quiz");
      return;
    }

    const msgTimer = setInterval(() => setMsgIdx(i => (i + 1) % LOADING_MSGS.length), 1400);
    const progTimer = setInterval(
      () => setProg(v => (v >= 100 ? 100 : Math.min(90, v + 1.5))),
      100
    );

    let cancelled = false;

    async function fetchMatches() {
      try {
        const payload = {
          gpa: profile!.gpa || "",
          intendedMajor: profile!.major || "",
          incomeRange: profile!.income || "",
          firstGen: profile!.firstGen || "",
          location: profile!.state || "",
          extracurricularStrength: profile!.extracurricular || "",
          leadershipStrength: profile!.leadership || "",
          preferredRegion: profile!.region || "",
          schoolSize: profile!.size || "",
          campusSetting: profile!.setting || "",
          ratings: {
            career: profile!.career,
            affordability: profile!.affordability,
            food: profile!.food,
            gym: profile!.gym,
            study: profile!.study,
            social: profile!.social,
            academicRep: profile!.academicRep,
          },
        };

        const res = await fetch(`${API_BASE}/api/preferences`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        const data: { success?: boolean; matches?: Match[] } = await res.json();

        if (cancelled) return;

        const matches: Match[] = Array.isArray(data.matches) ? data.matches : [];

        setResults({ matches, profile: profile! });
        clearInterval(msgTimer);
        clearInterval(progTimer);
        setProg(100);
        setTimeout(() => { if (!cancelled) setPage("results"); }, 300);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch matches:", err);
        setErrorMsg(err instanceof Error ? err.message : "Could not reach the backend.");
      }
    }

    fetchMatches();

    return () => {
      cancelled = true;
      clearInterval(msgTimer);
      clearInterval(progTimer);
    };
  }, [profile, setPage, setResults]);

  return (
    <div style={{ background: "#080814", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 440, padding: "0 24px" }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg,#6366f1,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 24px", boxShadow: "0 0 60px rgba(99,102,241,0.5)", color: "#fff", fontWeight: 800 }}>S</div>

        {errorMsg ? (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Couldn&apos;t load matches</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 24 }}>{errorMsg}</p>
            <button onClick={() => setPage("quiz")} style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", border: "none", borderRadius: 12, padding: "12px 22px", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              Try again
            </button>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Analyzing your profile</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 36, minHeight: 22, transition: "opacity 0.3s" }}>{LOADING_MSGS[msgIdx]}</p>
            <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ height: "100%", width: `${prog}%`, background: "linear-gradient(90deg,#6366f1,#a855f7)", borderRadius: 999, transition: "width 0.1s linear" }} />
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{Math.round(prog)}% complete</div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── RESULTS PAGE ─────────────────────────────────────────────────────────────
type ResultsPageProps = {
  results: Results | null;
  setPage: (p: Page) => void;
};
function ResultsPage({ results, setPage }: ResultsPageProps) {
  const [expanded, setExpanded] = useState<string | number | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [savedEmail, setSavedEmail] = useState<string>("");
  const [savedPwd, setSavedPwd] = useState<string>("");
  const [saved, setSaved] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"All" | Category>("All");

  if (!results) return null;
  const { matches, profile } = results;
  const name = profile.major ? profile.major.split(" ")[0] : "STU";
  const refCode = `scholr.ai/invite/${name.substring(0, 4).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;

  const cats: ("All" | Category)[] = ["All", "Reach", "Target", "Safety", "Hidden Gem"];
  const filtered = activeTab === "All" ? matches : matches.filter(m => m.scores.category === activeTab);

  const catCounts: Partial<Record<Category, number>> = {};
  matches.forEach(m => {
    catCounts[m.scores.category] = (catCounts[m.scores.category] || 0) + 1;
  });

  return (
    <div style={{ background: "#080814", minHeight: "100vh", paddingTop: 60, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: 800, height: 400, background: "radial-gradient(ellipse, rgba(99,102,241,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 20, padding: "5px 12px", marginBottom: 16, fontSize: 12, color: "#34d399", fontWeight: 600 }}>
            ✓ {matches.length} matches found
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 8 }}>Your College Matches</h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}>Based on your GPA, major, finances, and preferences — sorted by match score.</p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
          {(Object.entries(catCounts) as [Category, number][]).map(([cat, n]) => (
            <div key={cat} style={{ background: catBg[cat], border: `1px solid ${catColor[cat]}33`, borderRadius: 20, padding: "6px 14px", fontSize: 12, color: catColor[cat], fontWeight: 700 }}>
              {n} {cat}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 0 }}>
          {cats.map(c => (
            <button key={c} onClick={() => setActiveTab(c)} style={{
              background: "none", border: "none", padding: "8px 14px", fontSize: 13, fontWeight: activeTab === c ? 700 : 500,
              color: activeTab === c ? "#fff" : "rgba(255,255,255,0.4)", cursor: "pointer",
              borderBottom: activeTab === c ? "2px solid #6366f1" : "2px solid transparent", marginBottom: -1,
            }}>
              {c} {c !== "All" && catCounts[c] ? `(${catCounts[c]})` : ""}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 40 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.4)", fontSize: 14 }}>
              No matches in this category.
            </div>
          ) : (
            filtered.map((match) => {
              const key = match.college.id ?? match.college.name;
              return (
                <CollegeCard
                  key={key}
                  match={match}
                  profile={profile}
                  expanded={expanded === key}
                  onToggle={() => setExpanded(expanded === key ? null : key)}
                />
              );
            })
          )}
        </div>

        <div style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 24, padding: "28px 24px", marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 4 }}> Invite Friends to Scholr</h3>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 16, lineHeight: 1.6 }}>Refer friends to unlock deeper college insights and future personalized tools.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#c4b5fd", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{refCode}</div>
            <button onClick={() => { navigator.clipboard?.writeText(refCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)", border: "none", borderRadius: 12, padding: "10px 18px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
              {copied ? "✓ Copied!" : "Copy Link"}
            </button>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 10 }}> 0 referrals so far · Share to unlock premium insights</div>
        </div>

      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState<Page>("landing");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [results, setResults] = useState<Results | null>(null);

  const handleSetPage = useCallback((p: Page) => {
    window.scrollTo(0, 0);
    setPage(p);
  }, []);

  return (
    <div>
      <NavBar page={page} setPage={handleSetPage} />
      {page === "landing" && <LandingPage setPage={handleSetPage} />}
      {page === "quiz" && <QuizPage setPage={handleSetPage} setProfile={setProfile} />}
      {page === "loading" && <LoadingPage setPage={handleSetPage} profile={profile} setResults={setResults} />}
      {page === "results" && <ResultsPage results={results} setPage={handleSetPage} />}
    </div>
  );
}
