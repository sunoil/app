import { useState, useEffect, useRef, useMemo } from "react";
import { loadData, getPirusdBalance, getPirusdTransfers } from '../web3/funcs';




const C = {
  bg: "#f0f4f8", primary: "#2dd4a8", primaryDark: "#1aab87",
  accent: "#7c5cfc", accentLight: "#a78bfa", accentGlow: "rgba(124,92,252,0.15)",
  text: "#1e293b", textSec: "#64748b", textMuted: "#94a3b8",
  border: "#e2e8f0", green: "#22c55e", chartLine: "#7c5cfc",
  tealBg: "rgba(45,212,168,0.08)", gold: "#eab308", goldBg: "rgba(234,179,8,0.10)",
};

const APR = 14.4;

// Generate month forecast: 4 weekly points from current balance compounding at APR
function buildMonthlyData(bal) {
  if (bal <= 0) return [{ label: "Now", value: 0 }, { label: "Wk 1", value: 0 }, { label: "Wk 2", value: 0 }, { label: "Wk 3", value: 0 }, { label: "Wk 4", value: 0 }];
  const weeklyRate = APR / 100 / 365 * 7;
  return ["Now", "Wk 1", "Wk 2", "Wk 3", "Wk 4"].map((label, i) => ({
    label, value: Math.round(bal * (1 + weeklyRate * i) * 100) / 100,
  }));
}

// Generate year forecast: 12 monthly points from current balance compounding at APR
function buildYearlyData(bal) {
  if (bal <= 0) return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map(label => ({ label, value: 0 }));
  const monthlyRate = APR / 100 / 12;
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((label, i) => ({
    label, value: Math.round(bal * Math.pow(1 + monthlyRate, i) * 100) / 100,
  }));
}

function useIsMobile(bp = 768) {
  // 1. Initialize with a safe default (false) for the server
  const [m, setM] = useState(false); 

  useEffect(() => { 
    // 2. This code ONLY runs in the browser
    const checkMobile = () => setM(window.innerWidth <= bp);
    
    // Set the actual value now that we are in the browser
    checkMobile(); 

    window.addEventListener("resize", checkMobile); 
    return () => window.removeEventListener("resize", checkMobile); 
  }, [bp]);

  return m;
}
function useInView(ref) {
  const [v, setV] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); ob.disconnect(); } }, { threshold: 0.1 });
    ob.observe(ref.current); return () => ob.disconnect();
  }, [ref]);
  return v;
}

// Helper: get current time in CET (UTC+1) as a Date-like object
function getNowCET() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 3600000); // +1h for CET
}

// Helper: create a Date representing midnight CET for a specific calendar date
function dateCET(y, m, d) {
  // midnight CET = 23:00 UTC the day before
  return new Date(Date.UTC(y, m, d) - 3600000);
}

// Reward dates: 6th, 16th, 26th of each month (all in CET)
function getRewardDates() {
  const cet = getNowCET();
  const day = cet.getDate(), m = cet.getMonth(), y = cet.getFullYear();
  if (day < 6)  return { start: dateCET(y, m - 1, 26), end: dateCET(y, m, 6) };
  if (day < 16) return { start: dateCET(y, m, 6),      end: dateCET(y, m, 16) };
  if (day < 26) return { start: dateCET(y, m, 16),     end: dateCET(y, m, 26) };
  return { start: dateCET(y, m, 26), end: dateCET(y, m + 1, 6) };
}

function getRewardTarget(balance, apr) {
  const { start, end } = getRewardDates();
  const periodDays = (end - start) / (1000 * 60 * 60 * 24);
  return balance * (apr / 100) * (periodDays / 365);
}

function getRewardProgress(balance, apr) {
  const now = new Date();
  const { start, end } = getRewardDates();
  const target = getRewardTarget(balance, apr);
  return target * Math.min((now - start) / (end - start), 1);
}

function getTimeUntilPayout() {
  const { end } = getRewardDates();
  return Math.max(0, end - new Date());
}

function LiveRewardCounter({ balance, apr, mobile }) {
  const [cur, setCur] = useState(() => getRewardProgress(balance, apr));
  useEffect(() => { const iv = setInterval(() => setCur(getRewardProgress(balance, apr)), 50); return () => clearInterval(iv); }, [balance, apr]);
  const whole = Math.floor(cur);
  const frac = (cur - whole).toFixed(8).slice(2);
  return (
    <div style={{ display: "flex", alignItems: "baseline", fontFamily: "'Space Mono',monospace", flexWrap: "wrap" }}>
      <span style={{ fontSize: mobile ? 14 : 18, fontWeight: 700, color: C.textSec }}>$</span>
      <span style={{ fontSize: mobile ? 28 : 34, fontWeight: 700, color: C.text, letterSpacing: "-0.03em", lineHeight: 1 }}>{whole.toLocaleString("en-US")}</span>
      <span style={{ fontSize: mobile ? 28 : 34, fontWeight: 700, color: C.textMuted }}>.</span>
      <span style={{ fontSize: mobile ? 15 : 17, fontWeight: 400, color: C.accent }}>{frac}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, marginLeft: 6, alignSelf: "flex-end", marginBottom: 2 }}>USDT</span>
    </div>
  );
}

function PayoutCountdown({ mobile }) {
  const [ms, setMs] = useState(() => getTimeUntilPayout());
  useEffect(() => { const iv = setInterval(() => setMs(getTimeUntilPayout()), 1000); return () => clearInterval(iv); }, []);
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60), ss = sec % 60;
  const pad = (n) => String(n).padStart(2, "0");
  const units = [{ v: pad(d), l: "d" }, { v: pad(h), l: "h" }, { v: pad(m), l: "m" }, { v: pad(ss), l: "s" }];
  return (
    <div style={{ display: "flex", gap: mobile ? 4 : 6 }}>
      {units.map((u, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: mobile ? 2 : 3 }}>
          {i > 0 && <span style={{ color: C.textMuted, fontSize: mobile ? 13 : 16, fontWeight: 300 }}>:</span>}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            background: "rgba(124,92,252,0.06)", borderRadius: 7,
            padding: mobile ? "5px 8px 4px" : "6px 10px 5px", minWidth: mobile ? 36 : 42,
          }}>
            <span style={{ fontSize: mobile ? 15 : 18, fontWeight: 700, fontFamily: "'Space Mono',monospace", color: C.text, lineHeight: 1 }}>{u.v}</span>
            <span style={{ fontSize: 8, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", marginTop: 2 }}>{u.l}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnimNum({ value, prefix = "", suffix = "", dec = 2 }) {
  const [d, setD] = useState(0);
  useEffect(() => {
    const dur = 1400, t0 = performance.now();
    const tick = (now) => { const p = Math.min((now - t0) / dur, 1); setD(value * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, [value]);
  return <span>{prefix}{d.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}{suffix}</span>;
}

/* ── Animated Chart with traveling glow + sparkle particles ── */
function Chart({ data, animate }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const progressRef = useRef(0);
  const startRef = useRef(null);

  useEffect(() => {
    if (animate) startRef.current = performance.now();
    else startRef.current = null;
  }, [animate, data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let running = true;

    const draw = () => {
      if (!running) return;
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      const w = rect.width, h = rect.height;
      const now = performance.now();
      const t = now / 1000; // time in seconds for animations

      // drawing progress
      if (startRef.current) {
        progressRef.current = Math.min((now - startRef.current) / 1400, 1);
        progressRef.current = 1 - Math.pow(1 - progressRef.current, 3);
      } else {
        progressRef.current = 1;
      }
      const prog = progressRef.current;

      const vals = data.map(d => d.value);
      const rawMn = Math.min(...vals), rawMx = Math.max(...vals);
      const mn = rawMx === 0 ? 0 : rawMn * 0.997, mx = rawMx === 0 ? 1 : rawMx * 1.003;
      const compact = w < 400;
      const pd = { top: 28, right: 16, bottom: 32, left: compact ? 44 : 56 };
      const cw = w - pd.left - pd.right, ch = h - pd.top - pd.bottom;

      ctx.clearRect(0, 0, w, h);

      // grid with fade
      const gN = 4;
      for (let i = 0; i <= gN; i++) {
        const y = pd.top + (ch / gN) * i;
        ctx.strokeStyle = `rgba(226,232,240,${0.7 * prog})`;
        ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(pd.left, y); ctx.lineTo(pd.left + cw * prog, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = prog;
        ctx.fillStyle = C.textMuted; ctx.font = `${compact ? 9 : 10}px 'DM Sans',sans-serif`; ctx.textAlign = "right";
        ctx.fillText("$" + (mx - ((mx - mn) / gN) * i).toFixed(0), pd.left - 7, y + 3);
        ctx.globalAlpha = 1;
      }

      // x labels
      const step = Math.max(1, Math.floor(data.length / (compact ? 5 : 10)));
      data.forEach((d, i) => {
        if (i % step !== 0 && i !== data.length - 1) return;
        const x = pd.left + (cw / (data.length - 1)) * i;
        ctx.globalAlpha = prog; ctx.fillStyle = C.textMuted;
        ctx.font = `${compact ? 9 : 10}px 'DM Sans',sans-serif`; ctx.textAlign = "center";
        ctx.fillText(d.label, x, h - 7); ctx.globalAlpha = 1;
      });

      // build points
      const allPts = data.map((d, i) => ({
        x: pd.left + (cw / (data.length - 1)) * i,
        y: pd.top + ch - ((d.value - mn) / (mx - mn)) * ch,
      }));

      // animated drawing: trim to progress
      const visCount = Math.max(2, Math.ceil(allPts.length * prog));
      const pts = allPts.slice(0, visCount);
      if (prog < 1 && visCount < allPts.length) {
        const frac = (allPts.length * prog) - Math.floor(allPts.length * prog);
        const a = allPts[visCount - 1], b = allPts[visCount];
        if (b) pts[pts.length - 1] = { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac };
      }

      // gradient fill with wave distortion
      ctx.beginPath(); ctx.moveTo(pts[0].x, pd.top + ch);
      pts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(pts[pts.length - 1].x, pd.top + ch); ctx.closePath();
      const grd = ctx.createLinearGradient(0, pd.top, 0, pd.top + ch);
      const fillAlpha = 0.06 + 0.03 * Math.sin(t * 1.5);
      grd.addColorStop(0, `rgba(124,92,252,${fillAlpha * prog})`);
      grd.addColorStop(0.6, `rgba(124,92,252,${fillAlpha * 0.3 * prog})`);
      grd.addColorStop(1, "rgba(124,92,252,0)");
      ctx.fillStyle = grd; ctx.fill();

      // main line
      function drawCurvePath(points) {
        ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          const xc = (points[i - 1].x + points[i].x) / 2, yc = (points[i - 1].y + points[i].y) / 2;
          ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
        }
        ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      }

      // glow under line
      drawCurvePath(pts);
      ctx.strokeStyle = `rgba(124,92,252,${0.15 + 0.05 * Math.sin(t * 2)})`;
      ctx.lineWidth = 8; ctx.stroke();

      // main line
      drawCurvePath(pts);
      ctx.strokeStyle = C.chartLine; ctx.lineWidth = 2.5; ctx.stroke();

      // dots
      pts.forEach((p, i) => {
        const isLast = i === pts.length - 1 && prog > 0.9;
        const r = isLast ? 5 + 1.5 * Math.sin(t * 3) : 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isLast ? C.chartLine : "#fff"; ctx.fill();
        ctx.strokeStyle = C.chartLine; ctx.lineWidth = 2; ctx.stroke();
      });

      // sparkle particles
      if (prog > 0.8) {
        for (let i = 0; i < 5; i++) {
          const sp = ((t * 0.08 + i * 0.2) % 1);
          const si = Math.floor(sp * (allPts.length - 1));
          const sf = (sp * (allPts.length - 1)) - si;
          const sa = allPts[si], sb = allPts[Math.min(si + 1, allPts.length - 1)];
          const sx = sa.x + (sb.x - sa.x) * sf;
          const sy = sa.y + (sb.y - sa.y) * sf - 10 - 15 * Math.sin(t * 2 + i);
          const sAlpha = 0.3 * (0.5 + 0.5 * Math.sin(t * 3 + i * 1.5)) * (prog - 0.8) * 5;
          ctx.globalAlpha = sAlpha;
          ctx.fillStyle = i % 2 === 0 ? C.accent : C.primary;
          ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // tooltip
      if (prog > 0.85) {
        const last = pts[pts.length - 1];
        const a = Math.min(1, (prog - 0.85) / 0.15);
        ctx.globalAlpha = a;
        const txt = "$" + data[Math.min(visCount - 1, data.length - 1)].value.toLocaleString();
        ctx.font = "bold 10px 'DM Sans',sans-serif";
        const tw2 = ctx.measureText(txt).width + 12, th2 = 22;
        let tx2 = last.x - tw2 / 2; if (tx2 + tw2 > w - 4) tx2 = w - tw2 - 4; if (tx2 < 4) tx2 = 4;
        const ty2 = last.y - th2 - 12, rr = 5;
        // shadow
        ctx.shadowColor = "rgba(124,92,252,0.25)"; ctx.shadowBlur = 10;
        ctx.fillStyle = C.chartLine; ctx.beginPath();
        ctx.moveTo(tx2 + rr, ty2); ctx.lineTo(tx2 + tw2 - rr, ty2);
        ctx.quadraticCurveTo(tx2 + tw2, ty2, tx2 + tw2, ty2 + rr); ctx.lineTo(tx2 + tw2, ty2 + th2 - rr);
        ctx.quadraticCurveTo(tx2 + tw2, ty2 + th2, tx2 + tw2 - rr, ty2 + th2); ctx.lineTo(tx2 + rr, ty2 + th2);
        ctx.quadraticCurveTo(tx2, ty2 + th2, tx2, ty2 + th2 - rr); ctx.lineTo(tx2, ty2 + rr);
        ctx.quadraticCurveTo(tx2, ty2, tx2 + rr, ty2); ctx.fill();
        ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
        const ax = Math.min(Math.max(last.x, tx2 + 5), tx2 + tw2 - 5);
        ctx.beginPath(); ctx.moveTo(ax - 4, ty2 + th2); ctx.lineTo(ax, ty2 + th2 + 4); ctx.lineTo(ax + 4, ty2 + th2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "bold 10px 'DM Sans',sans-serif"; ctx.textAlign = "center";
        ctx.fillText(txt, tx2 + tw2 / 2, ty2 + th2 / 2 + 3.5);
        ctx.globalAlpha = 1;
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => { running = false; cancelAnimationFrame(frameRef.current); };
  }, [data, animate]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
}

function Particles() {
  const dots = useMemo(() => Array.from({ length: 14 }, () => ({
    x: Math.random() * 100, y: Math.random() * 100, size: 2 + Math.random() * 2.5,
    dur: 14 + Math.random() * 18, delay: Math.random() * -20, op: 0.06 + Math.random() * 0.05,
  })), []);
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      {dots.map((d, i) => (
        <div key={i} style={{
          position: "absolute", left: d.x + "%", top: d.y + "%", width: d.size, height: d.size,
          borderRadius: "50%", background: i % 2 === 0 ? C.accent : C.primary, opacity: d.op,
          animation: `float ${d.dur}s ease-in-out ${d.delay}s infinite`,
        }} />
      ))}
    </div>
  );
}

function Reveal({ children, delay = 0 }) {
  const ref = useRef(null); const vis = useInView(ref);
  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(18px)",
      transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
    }}>{children}</div>
  );
}

/* ══════════ MAIN ══════════ */
export default function App() {
  const mob = useIsMobile();
  const [period, setPeriod] = useState("month");
  const [wallet, setWallet] = useState("");
  const [searching, setSearching] = useState(false);
  const [pirusdBalance, setPirusdBalance] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [totalRewards, setTotalRewards] = useState(0);
  const [error, setError] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showIOSTip, setShowIOSTip] = useState(false);
  const chartRef = useRef(null);
  const chartVis = useInView(chartRef);

  // Capture the browser's install prompt (Chrome/Android)
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Detect if already installed as PWA (hide button)
  const [isInstalled, setIsInstalled] = useState(false);
  useEffect(() => {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }
    if (window.navigator.standalone === true) setIsInstalled(true);
  }, []);

  const handleInstall = async () => {
    if (installPrompt) {
      // Chrome / Android — trigger the native prompt
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") {
        setInstallPrompt(null);
      }
    } else {
      // iOS / other browsers — show instructions tooltip
      setShowIOSTip(prev => !prev);
    }
  };

  // Restore last looked-up wallet from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("twopir_wallet");
      if (saved) {
        setWallet(saved);
      }
    } catch (e) {}
  }, []);

  // Auto-search when wallet is restored from localStorage
  const hasAutoSearched = useRef(false);
  useEffect(() => {
    if (wallet && !hasAutoSearched.current && pirusdBalance === null) {
      hasAutoSearched.current = true;
      handleSearch();
    }
  }, [wallet]);

  const handleSearch = async () => {
    if (!wallet.trim()) return;
    setSearching(true);
    setError("");
    const addr = wallet.trim();

    // Save address for next visit
    try { localStorage.setItem("twopir_wallet", addr); } catch (e) {}

    // Fetch balance independently from transfers
    try {
      const bal = await getPirusdBalance(addr);
      setPirusdBalance(bal);
    } catch (err) {
      console.error("Balance fetch failed:", err);
      setError("Failed to load balance: " + err.message);
    }

    // Fetch transfers separately so balance still works if this fails
    try {
      const txData = await getPirusdTransfers(addr);
      setTransfers(txData.transfers);
      setTotalRewards(txData.totalRewards);
    } catch (err) {
      console.error("Transfers fetch failed:", err);
      setError(prev => prev ? prev + " | Transfers: " + err.message : "Failed to load transfers: " + err.message);
    }

    setSearching(false);
  };
  const balance = pirusdBalance !== null ? pirusdBalance : 0;
  const rewardTarget = getRewardTarget(balance, APR);
  const monthlyData = useMemo(() => buildMonthlyData(balance), [balance]);
  const yearlyData = useMemo(() => buildYearlyData(balance), [balance]);
  const data = period === "month" ? monthlyData : yearlyData;
  const gain = data[data.length - 1].value - balance;
  const gainPct = balance > 0 ? ((gain / balance) * 100).toFixed(2) : "0.00";

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#f0f4f8 0%,#e8eef5 40%,#f0f0fa 100%)", fontFamily: "'DM Sans',-apple-system,sans-serif", color: C.text, position: "relative" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-25px) scale(1.15)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes pulseGlow{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes breathe{0%,100%{box-shadow:0 0 0 0 rgba(45,212,168,0.2)}50%{box-shadow:0 0 0 6px rgba(45,212,168,0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes countPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
        *{box-sizing:border-box}
      `}</style>
      <Particles />

      {/* ── HEADER ── */}
      <header style={{
        background: "rgba(255,255,255,0.78)", backdropFilter: "blur(24px) saturate(1.4)",
        borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: mob ? "10px 14px" : "0 24px",
          minHeight: mob ? "auto" : 56, display: "flex", alignItems: mob ? "stretch" : "center",
          justifyContent: "space-between", flexDirection: mob ? "column" : "row", gap: mob ? 8 : 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "linear-gradient(135deg, #2dd4a8 0%, #3b9ec9 40%, #6366f1 80%, #7c5cfc 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 14px rgba(99,102,241,0.35)", animation: "breathe 3s ease-in-out infinite",
              }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "'Space Mono',monospace", letterSpacing: "-0.04em" }}>2πR</span>
              </div>
              <span style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Space Mono',monospace", letterSpacing: "-0.02em",
                background: "linear-gradient(135deg, #2dd4a8, #6366f1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>TwoPiR</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 16,
                border: `1px solid ${C.border}`, fontSize: 11, fontWeight: 500, color: C.textSec, background: "#fff", whiteSpace: "nowrap", flexShrink: 0,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#e84142", animation: "pulseGlow 2s ease-in-out infinite" }} />
                <span>{mob ? "AVAX" : "Avalanche"}</span>
              </div>
              {/* Install App button */}
              {!isInstalled && (
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <button onClick={handleInstall} style={{
                    display: "flex", alignItems: "center", gap: 5, height: 34, padding: "0 12px",
                    borderRadius: 10, border: `1.5px solid ${C.accent}`, background: C.accentGlow,
                    color: C.accent, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap", transition: "all 0.2s",
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12l7 7 7-7"/>
                    </svg>
                    Install
                  </button>
                  {showIOSTip && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 200,
                      background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12,
                      padding: "12px 14px", boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                      width: 220, fontSize: 12, color: C.text, lineHeight: 1.5,
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Install on your device</div>
                      <div>Tap the <strong>Share</strong> button <span style={{ fontSize: 15 }}>⎋</span> in your browser, then select <strong>&quot;Add to Home Screen&quot;</strong>.</div>
                      <button onClick={() => setShowIOSTip(false)} style={{
                        marginTop: 8, border: "none", background: C.accentGlow, color: C.accent,
                        borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                      }}>Got it</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              flex: 1, display: "flex", alignItems: "center", background: "#fff",
              border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "0 10px", height: mob ? 38 : 36,
              transition: "border-color 0.3s",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input type="text" placeholder="Paste wallet address (0x…)" value={wallet}
                onChange={e => setWallet(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()}
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", padding: "0 8px", fontSize: 12, fontFamily: "'DM Sans',sans-serif", color: C.text, height: "100%" }} />
              {wallet && <button onClick={() => setWallet("")} style={{ border: "none", background: "none", cursor: "pointer", padding: 2, color: C.textMuted, fontSize: 14, lineHeight: 1 }}>×</button>}
            </div>
            <button onClick={handleSearch} style={{
              height: mob ? 38 : 36, padding: "0 14px", borderRadius: 10, border: "none",
              background: `linear-gradient(135deg,${C.primary},${C.primaryDark})`,
              color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
              boxShadow: "0 3px 12px rgba(45,212,168,0.25)", whiteSpace: "nowrap",
            }}>{searching ? "…" : "Look Up"}</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: mob ? "14px 12px 40px" : "22px 24px 50px", position: "relative", zIndex: 1 }}>

        {/* Error banner */}
        {error && (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 10, padding: "10px 14px", marginBottom: 10,
            fontSize: 11, color: "#dc2626", fontFamily: "'Space Mono',monospace", wordBreak: "break-all",
          }}>
            {error}
          </div>
        )}

        {/* ═══ BALANCE HERO ═══ */}
        <Reveal delay={0}>
          <div style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,255,255,0.85))",
            backdropFilter: "blur(10px)",
            borderRadius: mob ? 16 : 20, border: `1px solid ${C.border}`,
            padding: mob ? "20px 16px" : "24px 28px",
            marginBottom: mob ? 10 : 14, position: "relative", overflow: "hidden",
            boxShadow: "0 2px 20px rgba(0,0,0,0.04)",
          }}>
            {/* decorative gradient blob */}
            <div style={{ position: "absolute", top: -40, right: mob ? -20 : 60, width: 180, height: 180, background: "radial-gradient(circle, rgba(45,212,168,0.08) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -30, left: mob ? -20 : 80, width: 140, height: 140, background: "radial-gradient(circle, rgba(124,92,252,0.06) 0%, transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: mob ? 6 : 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Balance</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: mob ? 14 : 16 }}>
                <span style={{ fontSize: mob ? 36 : 44, fontWeight: 700, fontFamily: "'Space Mono',monospace", letterSpacing: "-0.03em", lineHeight: 1, color: C.text, animation: "slideUp 0.8s cubic-bezier(0.16,1,0.3,1) both" }}>
                  <AnimNum value={balance} prefix="$" />
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.textMuted }}>USDT</span>
              </div>

              {/* APR + Earned pills */}
              <div style={{ display: "flex", gap: mob ? 8 : 12, flexWrap: "wrap" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "rgba(124,92,252,0.06)", borderRadius: 12,
                  padding: mob ? "10px 14px" : "12px 18px",
                  border: "1px solid rgba(124,92,252,0.1)",
                  flex: mob ? "1 1 calc(50% - 4px)" : "0 0 auto",
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: C.accentGlow, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 600, color: C.textSec, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>Current APR</p>
                    <p style={{ fontSize: mob ? 20 : 22, fontWeight: 700, margin: 0, fontFamily: "'Space Mono',monospace", color: C.accent, lineHeight: 1.2 }}>
                      <AnimNum value={APR} suffix="%" />
                    </p>
                  </div>
                </div>

                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "rgba(234,179,8,0.06)", borderRadius: 12,
                  padding: mob ? "10px 14px" : "12px 18px",
                  border: "1px solid rgba(234,179,8,0.1)",
                  flex: mob ? "1 1 calc(50% - 4px)" : "0 0 auto",
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: C.goldBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 9, fontWeight: 600, color: C.textSec, margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Earned</p>
                    <p style={{ fontSize: mob ? 20 : 22, fontWeight: 700, margin: 0, fontFamily: "'Space Mono',monospace", color: C.gold, lineHeight: 1.2 }}>
                      <AnimNum value={totalRewards} prefix="$" />
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* ═══ ROW 2: Rewards + Auto Deposit ═══ */}
        <Reveal delay={0.08}>
          <div style={{
            display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr",
            gap: mob ? 10 : 14, marginBottom: mob ? 10 : 14,
          }}>
            {/* Accrued Rewards */}
            <div style={{
              background: "#fff", borderRadius: mob ? 14 : 16,
              border: `1.5px solid rgba(124,92,252,0.18)`, padding: mob ? "16px 14px" : "20px 22px",
              position: "relative", overflow: "hidden",
              boxShadow: "0 2px 16px rgba(124,92,252,0.05)",
            }}>
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)`,
                backgroundSize: "200% 100%", animation: "shimmer 3s linear infinite", opacity: 0.5,
              }} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "3px 10px 3px 7px", borderRadius: 14,
                  background: `linear-gradient(135deg,${C.accent},${C.accentLight})`,
                  color: "#fff", fontSize: 10, fontWeight: 600, marginBottom: 12,
                  boxShadow: `0 2px 10px ${C.accentGlow}`,
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Accrued Rewards
                </div>
                <div style={{ animation: "countPulse 4s ease-in-out infinite" }}>
                  <LiveRewardCounter balance={balance} apr={APR} mobile={mob} />
                </div>
                <p style={{ fontSize: 11, color: C.textSec, margin: "10px 0 0", lineHeight: 1.5 }}>
                  Grows in real time. Auto-deposited on the 6th, 16th &amp; 26th (CET).
                </p>
              </div>
            </div>

            {/* Next Auto-Deposit */}
            <div style={{
              background: "#fff", borderRadius: mob ? 14 : 16,
              border: `1px solid ${C.border}`, padding: mob ? "16px 14px" : "20px 22px",
              display: "flex", flexDirection: "column", justifyContent: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: C.tealBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 600, color: C.textSec, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>Next Auto-Deposit</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.primary, margin: "2px 0 0", fontFamily: "'Space Mono',monospace" }}>${rewardTarget.toFixed(2)} USDT</p>
                </div>
              </div>
              <PayoutCountdown mobile={mob} />
              <p style={{ fontSize: 10, color: C.textMuted, margin: "10px 0 0", lineHeight: 1.4, textAlign: "center" }}>
                Rewards will be added to your balance automatically
              </p>
            </div>
          </div>
        </Reveal>

        {/* ═══ ROW 3: Chart + Sidebar ═══ */}
        <Reveal delay={0.14}>
          <div ref={chartRef} style={{
            display: mob ? "flex" : "grid",
            gridTemplateColumns: mob ? undefined : "1fr 260px",
            flexDirection: mob ? "column" : undefined, gap: mob ? 10 : 14,
          }}>
            <div style={{
              background: "#fff", borderRadius: mob ? 14 : 16,
              border: `1px solid ${C.border}`, padding: mob ? "16px 12px" : "20px 22px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <h2 style={{ fontSize: mob ? 14 : 16, fontWeight: 700, margin: 0 }}>Balance Forecast</h2>
                  <p style={{ fontSize: 11, color: C.textSec, margin: "2px 0 0" }}>
                    Projected: <span style={{ color: C.green, fontWeight: 600 }}>+${gain.toFixed(0)} ({gainPct}%)</span>
                  </p>
                </div>
                <div style={{ display: "flex", background: C.bg, borderRadius: 8, padding: 2 }}>
                  {["month", "year"].map(p => (
                    <button key={p} onClick={() => setPeriod(p)} style={{
                      padding: mob ? "4px 12px" : "5px 14px", borderRadius: 6, border: "none",
                      background: period === p ? "#fff" : "transparent",
                      fontSize: 11, fontWeight: 600, color: period === p ? C.accent : C.textSec,
                      cursor: "pointer", fontFamily: "'DM Sans',sans-serif",
                      boxShadow: period === p ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                      transition: "all 0.25s",
                    }}>{p === "month" ? "Month" : "Year"}</button>
                  ))}
                </div>
              </div>
              <div style={{ height: mob ? 200 : 240 }}>
                <Chart data={data} animate={chartVis} />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: mob ? 10 : 14 }}>
              <div style={{
                background: "#fff", borderRadius: mob ? 14 : 16,
                border: `1px solid ${C.border}`, padding: mob ? "14px 12px" : "18px 18px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 10px", color: C.text }}>How Rewards Work</p>
                {[
                  "Rewards accrue every second based on balance & APR.",
                  "On the 6th, 16th & 26th (CET), they auto-deposit to your wallet.",
                  "New deposits qualify starting from the next reward date.",
                ].map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 7, fontSize: 11, color: C.textSec, lineHeight: 1.5 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: "50%", background: C.tealBg, color: C.primary,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, flexShrink: 0,
                    }}>{i + 1}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        {/* ═══ ROW 4: Transaction History ═══ */}
        <Reveal delay={0.2}>
          <div style={{
            background: "#fff", borderRadius: mob ? 14 : 16,
            border: `1px solid ${C.border}`, padding: mob ? "16px 12px" : "20px 22px",
            marginTop: mob ? 10 : 14,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
                <h2 style={{ fontSize: mob ? 14 : 16, fontWeight: 700, margin: 0 }}>Transaction History</h2>
              </div>
              {transfers.length > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: C.gold,
                  background: C.goldBg, padding: "3px 10px", borderRadius: 10,
                  fontFamily: "'Space Mono',monospace",
                }}>
                  Total: ${totalRewards.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {transfers.length === 0 ? (
              <div style={{
                textAlign: "center", padding: mob ? "24px 12px" : "36px 20px",
                color: C.textMuted, fontSize: 12,
              }}>
                {pirusdBalance === null
                  ? "Look up a wallet to see transaction history"
                  : "No incoming pirusd transfers found for this wallet"}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                {/* Table header */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto",
                  gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border}`,
                  fontSize: 9, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  <span>Date</span>
                  <span>Amount</span>
                  <span>From</span>
                  <span>Tx</span>
                </div>

                {/* Transaction rows */}
                {transfers.map((tx, i) => (
                  <div key={tx.txHash + i} style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto",
                    gap: 8, padding: "10px 0",
                    borderBottom: i < transfers.length - 1 ? `1px solid ${C.border}` : "none",
                    fontSize: 12, alignItems: "center",
                  }}>
                    <span style={{ color: C.textSec, fontSize: 11 }}>
                      {tx.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                    <span style={{ fontWeight: 600, fontFamily: "'Space Mono',monospace", color: C.green, fontSize: 12 }}>
                      +${tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span style={{ color: C.textMuted, fontSize: 10, fontFamily: "'Space Mono',monospace" }}>
                      {tx.from.slice(0, 6)}...{tx.from.slice(-4)}
                    </span>
                    <a
                      href={`https://snowtrace.io/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: C.accent, display: "flex", alignItems: "center" }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Reveal>
      </main>
    </div>
  );

}

