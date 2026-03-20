import { useState } from "react";

const colors = { primary: "#1F4E79", secondary: "#2E75B6", success: "#22C55E", warning: "#F59E0B", danger: "#EF4444", bg: "#F8FAFC", card: "#FFFFFF", border: "#E2E8F0", text: "#1E293B", muted: "#94A3B8" };

const MobileFrame = ({ children, title, tabs, activeTab, onTab }) => (
  <div style={{ width: 375, minHeight: 700, background: colors.bg, borderRadius: 24, border: `2px solid ${colors.border}`, overflow: "hidden", fontFamily: "-apple-system, sans-serif", display: "flex", flexDirection: "column" }}>
    <div style={{ background: colors.primary, padding: "16px 20px", color: "#fff" }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>MECANIX Technician</div>
    </div>
    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>{children}</div>
    {tabs && (
      <div style={{ display: "flex", borderTop: `1px solid ${colors.border}`, background: "#fff" }}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => onTab(t.id)} style={{ flex: 1, padding: "10px 0", textAlign: "center", cursor: "pointer", color: activeTab === t.id ? colors.primary : colors.muted, borderTop: activeTab === t.id ? `2px solid ${colors.primary}` : "2px solid transparent" }}>
            <div style={{ fontSize: 18 }}>{t.icon}</div>
            <div style={{ fontSize: 10, marginTop: 2 }}>{t.label}</div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const Badge = ({ children, color }) => (
  <span style={{ background: color, color: "#fff", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{children}</span>
);

// ── SCREENS ───────────────────────────────────────────────────────

const HomeScreen = () => (
  <>
    {/* Active Timer Banner */}
    <div style={{ background: colors.success, borderRadius: 16, padding: 16, color: "#fff", marginBottom: 16 }}>
      <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>ACTIVE TIMER</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>AB-12-34 \u2022 Toyota Hilux</div>
          <div style={{ fontSize: 12, opacity: 0.9 }}>Full service \u2022 JC-001</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace" }}>02:34:12</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button style={{ flex: 1, padding: 10, borderRadius: 10, border: "2px solid rgba(255,255,255,0.5)", background: "transparent", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Pause</button>
        <button style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: "#fff", color: colors.danger, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Stop</button>
      </div>
    </div>

    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: colors.text }}>Today's Jobs (4)</div>

    {[
      { plate: "CD-56-78", car: "Nissan NP300", task: "Transmission repair", time: "Est. 6h", status: "next", priority: "High" },
      { plate: "EF-90-12", car: "Honda Civic", task: "Diagnostics", time: "Est. 1h", status: "waiting", priority: "Normal" },
      { plate: "MN-45-67", car: "Ford Ranger", task: "AC recharge", time: "Est. 2h", status: "waiting", priority: "Normal" },
    ].map((j, i) => (
      <div key={i} style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, border: `1px solid ${colors.border}`, borderLeft: j.priority === "High" ? `4px solid ${colors.danger}` : `4px solid ${colors.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{j.plate}</span>
          {j.priority === "High" && <Badge color={colors.danger}>High</Badge>}
        </div>
        <div style={{ fontSize: 13, color: colors.muted }}>{j.car}</div>
        <div style={{ fontSize: 14, marginTop: 4 }}>{j.task}</div>
        <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{j.time}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: colors.primary, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", minHeight: 44 }}>Start Work</button>
          <button style={{ padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: "#fff", color: colors.text, fontSize: 13, cursor: "pointer", minHeight: 44 }}>Details</button>
        </div>
      </div>
    ))}
  </>
);

const TimerLogScreen = () => (
  <>
    <div style={{ textAlign: "center", marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: colors.muted }}>Today's Total</div>
      <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "monospace", color: colors.primary }}>05:47:30</div>
      <div style={{ fontSize: 12, color: colors.success }}>Utilisation: 82%</div>
    </div>
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Time Log</div>
    {[
      { job: "JC-001 \u2022 AB-12-34", task: "Full service", time: "2h 34m", status: "Active" },
      { job: "JC-005 \u2022 IJ-78-90", task: "Brake pads", time: "1h 45m", status: "Done" },
      { job: "JC-007 \u2022 OP-12-34", task: "Oil change", time: "1h 28m", status: "Done" },
    ].map((t, i) => (
      <div key={i} style={{ background: "#fff", borderRadius: 10, padding: 12, marginBottom: 8, border: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{t.job}</div>
          <div style={{ fontSize: 12, color: colors.muted }}>{t.task}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontFamily: "monospace" }}>{t.time}</div>
          <Badge color={t.status === "Active" ? colors.success : colors.muted}>{t.status}</Badge>
        </div>
      </div>
    ))}
  </>
);

const ProductivityScreen = () => (
  <>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
      {[
        { label: "Hours Today", value: "5h 47m", color: colors.primary },
        { label: "Jobs Today", value: "3", color: colors.success },
        { label: "This Week", value: "28h 15m", color: colors.secondary },
        { label: "Utilisation", value: "82%", color: colors.warning },
      ].map(s => (
        <div key={s.label} style={{ background: "#fff", borderRadius: 12, padding: 12, border: `1px solid ${colors.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: colors.muted }}>{s.label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Weekly Hours (Last 8 Weeks)</div>
    <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: `1px solid ${colors.border}` }}>
      <div style={{ display: "flex", alignItems: "flex-end", height: 100, gap: 6 }}>
        {[32, 28, 35, 30, 38, 33, 36, 28].map((h, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: "100%", background: i === 7 ? colors.primary : colors.accent, borderRadius: "4px 4px 0 0", height: h * 2.5 }} />
            <div style={{ fontSize: 9, color: colors.muted, marginTop: 4 }}>W{i + 1}</div>
          </div>
        ))}
      </div>
    </div>
  </>
);

const JobDetailScreen = () => (
  <>
    <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: `1px solid ${colors.border}`, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>CD-56-78</span>
        <Badge color="#8B5CF6">Awaiting Approval</Badge>
      </div>
      <div style={{ fontSize: 14 }}>Nissan NP300 2.5 TDi \u2022 2019</div>
      <div style={{ fontSize: 13, color: colors.muted }}>Customer: Maria Santos</div>
      <div style={{ marginTop: 12, padding: 12, background: colors.accent, borderRadius: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Reported Problem</div>
        <div style={{ fontSize: 13 }}>Transmission slipping between 3rd and 4th gear. Noise when accelerating.</div>
      </div>
    </div>

    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Quick Actions</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
      {[
        { icon: "📝", label: "Add Note", color: colors.primary },
        { icon: "📷", label: "Take Photo", color: colors.secondary },
        { icon: "🔧", label: "Parts Needed", color: colors.warning },
        { icon: "🚫", label: "Blocked", color: colors.danger },
      ].map(a => (
        <button key={a.label} style={{ padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, background: "#fff", display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", minHeight: 48 }}>
          <span style={{ fontSize: 20 }}>{a.icon}</span>{a.label}
        </button>
      ))}
    </div>
    <button style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: colors.success, color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", minHeight: 50 }}>Mark Complete</button>
  </>
);

// ── MAIN ──────────────────────────────────────────────────────────

const tabs = [
  { id: "home", icon: "🏠", label: "My Jobs" },
  { id: "timer", icon: "⏱️", label: "Timer Log" },
  { id: "productivity", icon: "📊", label: "Stats" },
  { id: "detail", icon: "📋", label: "Job Detail" },
];

const screenMap = { home: HomeScreen, timer: TimerLogScreen, productivity: ProductivityScreen, detail: JobDetailScreen };

export default function TechnicianApp() {
  const [tab, setTab] = useState("home");
  const Screen = screenMap[tab];
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 32, background: "#F1F5F9", minHeight: "100vh" }}>
      <MobileFrame title={tab === "home" ? "My Jobs" : tab === "timer" ? "Timer Log" : tab === "productivity" ? "My Stats" : "Job Detail"} tabs={tabs} activeTab={tab} onTab={setTab}>
        <Screen />
      </MobileFrame>
    </div>
  );
}
