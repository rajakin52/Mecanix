import { useState } from "react";

const colors = { primary: "#1F4E79", secondary: "#2E75B6", success: "#22C55E", warning: "#F59E0B", danger: "#EF4444", bg: "#F8FAFC", card: "#FFFFFF", border: "#E2E8F0", text: "#1E293B", muted: "#94A3B8" };

const MobileFrame = ({ children, title, tabs, activeTab, onTab }) => (
  <div style={{ width: 375, minHeight: 700, background: colors.bg, borderRadius: 24, border: `2px solid ${colors.border}`, overflow: "hidden", fontFamily: "-apple-system, sans-serif", display: "flex", flexDirection: "column" }}>
    <div style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`, padding: "16px 20px", color: "#fff" }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 12, opacity: 0.7 }}>MECANIX Customer</div>
    </div>
    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>{children}</div>
    {tabs && (
      <div style={{ display: "flex", borderTop: `1px solid ${colors.border}`, background: "#fff" }}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => onTab(t.id)} style={{ flex: 1, padding: "10px 0", textAlign: "center", cursor: "pointer", color: activeTab === t.id ? colors.primary : colors.muted }}>
            <div style={{ fontSize: 18 }}>{t.icon}</div>
            <div style={{ fontSize: 10, marginTop: 2 }}>{t.label}</div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const OnboardingScreen = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 40 }}>
    <div style={{ fontSize: 48, marginBottom: 16 }}>🚗</div>
    <h2 style={{ fontSize: 22, margin: "0 0 8px", color: colors.primary }}>Welcome to MECANIX</h2>
    <p style={{ fontSize: 14, color: colors.muted, textAlign: "center", marginBottom: 32 }}>Track your vehicle repairs in real time, approve quotes, and pay from your phone.</p>
    <div style={{ width: "100%", marginBottom: 12 }}>
      <label style={{ fontSize: 12, color: colors.muted }}>Phone Number</label>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <select style={{ padding: "12px 8px", borderRadius: 10, border: `1px solid ${colors.border}`, fontSize: 14, width: 80 }}><option>+244</option><option>+258</option><option>+55</option></select>
        <input placeholder="923 456 789" style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${colors.border}`, fontSize: 16 }} />
      </div>
    </div>
    <button style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: colors.primary, color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer", marginTop: 8 }}>Send OTP Code</button>
    <p style={{ fontSize: 11, color: colors.muted, textAlign: "center", marginTop: 16 }}>We'll send a one-time code via SMS to verify your number. No passwords needed.</p>
  </div>
);

const TrackingScreen = () => {
  const steps = [
    { label: "Received", done: true },
    { label: "Diagnosing", done: true },
    { label: "Awaiting Approval", active: true },
    { label: "In Progress", done: false },
    { label: "Ready", done: false },
  ];
  return (
    <>
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: `1px solid ${colors.border}`, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>CD-56-78</span>
          <span style={{ fontSize: 13, color: colors.muted }}>JC-002</span>
        </div>
        <div style={{ fontSize: 14 }}>Nissan NP300 \u2022 Transmission repair</div>
        <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>AutoPro Workshop, Luanda</div>
        <div style={{ fontSize: 12, color: colors.secondary, marginTop: 4 }}>Est. completion: 14 March 2026</div>
      </div>

      {/* Progress Steps */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: `1px solid ${colors.border}`, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Repair Progress</div>
        {steps.map((s, i) => (
          <div key={s.label} style={{ display: "flex", gap: 12, marginBottom: i < steps.length - 1 ? 0 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 20, height: 20, borderRadius: 10, background: s.done ? colors.success : s.active ? colors.warning : colors.border, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10 }}>{s.done ? "✓" : ""}</div>
              {i < steps.length - 1 && <div style={{ width: 2, height: 24, background: s.done ? colors.success : colors.border }} />}
            </div>
            <div style={{ paddingBottom: 12 }}>
              <div style={{ fontWeight: s.active ? 700 : 400, fontSize: 14, color: s.active ? colors.warning : s.done ? colors.text : colors.muted }}>{s.label}</div>
              {s.active && <div style={{ fontSize: 12, color: colors.warning }}>Waiting for your approval</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Action */}
      <button style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: colors.warning, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>View & Approve Quote</button>

      {/* Photo Updates */}
      <div style={{ marginTop: 16, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Photo Updates</div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        {["Front damage", "Under hood", "Transmission"].map((p, i) => (
          <div key={i} style={{ minWidth: 100, height: 80, background: colors.accent, borderRadius: 10, display: "flex", alignItems: "flex-end", padding: 6, fontSize: 10, color: colors.muted }}>{p}</div>
        ))}
      </div>
    </>
  );
};

const QuoteApprovalScreen = () => (
  <>
    <div style={{ background: "#fff", borderRadius: 16, padding: 16, border: `1px solid ${colors.border}`, marginBottom: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Quote for JC-002</div>

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: colors.muted }}>LABOUR</div>
      {[
        { desc: "Engine diagnostics", hrs: "2.0h", total: "$90.00" },
        { desc: "Transmission repair", hrs: "6.0h", total: "$270.00" },
      ].map((l, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
          <div><div>{l.desc}</div><div style={{ fontSize: 11, color: colors.muted }}>{l.hrs} @ $45/h</div></div>
          <span style={{ fontWeight: 600 }}>{l.total}</span>
        </div>
      ))}

      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, marginTop: 12, color: colors.muted }}>PARTS</div>
      {[
        { desc: "Transmission fluid (5L)", qty: "x2", total: "$91.00" },
        { desc: "Gasket set", qty: "x1", total: "$150.00" },
      ].map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
          <div><div>{p.desc}</div><div style={{ fontSize: 11, color: colors.muted }}>{p.qty}</div></div>
          <span style={{ fontWeight: 600 }}>{p.total}</span>
        </div>
      ))}

      <div style={{ marginTop: 12, padding: 12, background: colors.accent, borderRadius: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}><span>Subtotal</span><span>$601.00</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}><span>IVA (14%)</span><span>$84.14</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, borderTop: `2px solid ${colors.primary}`, paddingTop: 8 }}><span>Total</span><span>$685.14</span></div>
        <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>Insurance covers: $535.14 \u2022 Your excess: $150.00</div>
      </div>
    </div>

    <textarea placeholder="Add a comment (optional)..." style={{ width: "100%", padding: 12, borderRadius: 10, border: `1px solid ${colors.border}`, fontSize: 14, marginBottom: 12, resize: "none", height: 60, boxSizing: "border-box" }} />

    <div style={{ display: "flex", gap: 10 }}>
      <button style={{ flex: 1, padding: 14, borderRadius: 12, border: `2px solid ${colors.danger}`, background: "#fff", color: colors.danger, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Reject</button>
      <button style={{ flex: 2, padding: 14, borderRadius: 12, border: "none", background: colors.success, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>Approve Quote</button>
    </div>
  </>
);

const HistoryScreen = () => (
  <>
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>My Vehicles</div>
    <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
      {[{ plate: "CD-56-78", car: "Nissan NP300", active: true }, { plate: "QR-34-56", car: "Honda Jazz", active: false }].map(v => (
        <div key={v.plate} style={{ minWidth: 140, padding: 12, borderRadius: 12, background: v.active ? colors.primary : "#fff", color: v.active ? "#fff" : colors.text, border: `1px solid ${v.active ? colors.primary : colors.border}`, cursor: "pointer" }}>
          <div style={{ fontWeight: 700, fontFamily: "monospace" }}>{v.plate}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>{v.car}</div>
        </div>
      ))}
    </div>

    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Service History</div>
    {[
      { date: "10 Mar 2026", shop: "AutoPro Workshop", work: "Transmission repair", cost: "$685.14", status: "In Progress" },
      { date: "15 Jan 2026", shop: "AutoPro Workshop", work: "Full service (60,000km)", cost: "$320.00", status: "Completed" },
      { date: "28 Sep 2025", shop: "MecAngola", work: "Brake pads + discs", cost: "$450.00", status: "Completed" },
      { date: "12 Jun 2025", shop: "AutoPro Workshop", work: "AC recharge + filter", cost: "$180.00", status: "Completed" },
    ].map((s, i) => (
      <div key={i} style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, border: `1px solid ${colors.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{s.work}</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{s.cost}</span>
        </div>
        <div style={{ fontSize: 12, color: colors.muted }}>{s.shop} \u2022 {s.date}</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>
          <span style={{ padding: "2px 8px", borderRadius: 8, background: s.status === "Completed" ? "#DCFCE7" : "#FEF3C7", color: s.status === "Completed" ? colors.success : colors.warning, fontWeight: 600 }}>{s.status}</span>
        </div>
      </div>
    ))}
    <button style={{ width: "100%", padding: 12, borderRadius: 12, border: `1px solid ${colors.border}`, background: "#fff", color: colors.primary, fontWeight: 600, fontSize: 14, cursor: "pointer", marginTop: 8 }}>Download Service Record (PDF)</button>
  </>
);

const MyVehiclesScreen = () => (
  <>
    {[
      { plate: "CD-56-78", car: "Nissan NP300 2.5 TDi", year: 2019, km: "112,000 km", activeJob: true },
      { plate: "QR-34-56", car: "Honda Jazz 1.3", year: 2022, km: "34,200 km", activeJob: false },
    ].map(v => (
      <div key={v.plate} style={{ background: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, border: `1px solid ${colors.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, fontFamily: "monospace" }}>{v.plate}</div>
            <div style={{ fontSize: 14 }}>{v.car} \u2022 {v.year}</div>
            <div style={{ fontSize: 12, color: colors.muted }}>{v.km}</div>
          </div>
          <div style={{ fontSize: 40 }}>🚗</div>
        </div>
        {v.activeJob && (
          <div style={{ marginTop: 12, padding: 10, background: "#FEF3C7", borderRadius: 10, fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>Active repair:</span> Transmission repair at AutoPro Workshop
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button style={{ flex: 1, padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: "#fff", fontSize: 13, cursor: "pointer" }}>History</button>
          {v.activeJob && <button style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: colors.primary, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Track Repair</button>}
        </div>
      </div>
    ))}
    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, marginTop: 8 }}>Upcoming Service</div>
    <div style={{ background: "#fff", borderRadius: 12, padding: 12, border: `1px solid ${colors.border}` }}>
      <div style={{ fontSize: 13 }}>CD-56-78 \u2022 <strong>Oil change due</strong></div>
      <div style={{ fontSize: 12, color: colors.muted }}>Next at 115,000 km (approx. April 2026)</div>
    </div>
  </>
);

// ── MAIN ──────────────────────────────────────────────────────────

const tabs = [
  { id: "vehicles", icon: "🚗", label: "Vehicles" },
  { id: "tracking", icon: "📍", label: "Track" },
  { id: "quote", icon: "✅", label: "Approve" },
  { id: "history", icon: "📋", label: "History" },
  { id: "onboarding", icon: "👤", label: "Sign Up" },
];

const screenMap = { vehicles: MyVehiclesScreen, tracking: TrackingScreen, quote: QuoteApprovalScreen, history: HistoryScreen, onboarding: OnboardingScreen };

export default function CustomerApp() {
  const [tab, setTab] = useState("vehicles");
  const Screen = screenMap[tab];
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 32, background: "#F1F5F9", minHeight: "100vh" }}>
      <MobileFrame title={tab === "vehicles" ? "My Vehicles" : tab === "tracking" ? "Live Tracking" : tab === "quote" ? "Approve Quote" : tab === "history" ? "Service History" : "Welcome"} tabs={tabs} activeTab={tab} onTab={setTab}>
        <Screen />
      </MobileFrame>
    </div>
  );
}
