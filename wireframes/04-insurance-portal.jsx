import { useState } from "react";

const colors = { primary: "#1F4E79", secondary: "#2E75B6", success: "#22C55E", warning: "#F59E0B", danger: "#EF4444", bg: "#F8FAFC", card: "#FFFFFF", border: "#E2E8F0", text: "#1E293B", muted: "#94A3B8" };

const Badge = ({ children, color }) => (
  <span style={{ background: color, color: "#fff", padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{children}</span>
);

const Card = ({ children, style }) => (
  <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 16, ...style }}>{children}</div>
);

const Button = ({ children, variant = "primary", style, onClick }) => {
  const styles = {
    primary: { background: colors.primary, color: "#fff" },
    success: { background: colors.success, color: "#fff" },
    danger: { background: colors.danger, color: "#fff" },
    ghost: { background: "#fff", color: colors.primary, border: `1px solid ${colors.border}` },
    warning: { background: colors.warning, color: "#fff" },
  };
  return <button onClick={onClick} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, ...styles[variant], ...style }}>{children}</button>;
};

const PortalNav = ({ active, onNavigate }) => (
  <div style={{ background: "#fff", borderBottom: `1px solid ${colors.border}`, padding: "0 24px", display: "flex", alignItems: "center", gap: 24 }}>
    <div style={{ fontWeight: 800, fontSize: 18, color: colors.primary, padding: "16px 0", marginRight: 24 }}>MECANIX <span style={{ fontWeight: 400, fontSize: 13, color: colors.muted }}>Insurance Portal</span></div>
    {[
      { id: "claims", label: "Claims Queue" },
      { id: "review", label: "Estimate Review" },
      { id: "monitoring", label: "Repair Monitoring" },
      { id: "analytics", label: "Analytics" },
    ].map(t => (
      <div key={t.id} onClick={() => onNavigate(t.id)} style={{ padding: "16px 4px", cursor: "pointer", borderBottom: active === t.id ? `2px solid ${colors.primary}` : "2px solid transparent", color: active === t.id ? colors.primary : colors.muted, fontSize: 14, fontWeight: active === t.id ? 600 : 400 }}>{t.label}</div>
    ))}
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 32, height: 32, borderRadius: 16, background: colors.secondary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>EN</div>
      <span style={{ fontSize: 13 }}>ENSA Insurance</span>
    </div>
  </div>
);

// ── SCREENS ───────────────────────────────────────────────────────

const ClaimsQueueScreen = () => {
  const tabs = [
    { label: "New (4)", color: colors.secondary },
    { label: "In Review (3)", color: colors.warning },
    { label: "Approved (12)", color: colors.success },
    { label: "Rejected (2)", color: colors.danger },
    { label: "In Repair (5)", color: "#8B5CF6" },
    { label: "Completed (28)", color: colors.muted },
  ];
  const claims = [
    { ref: "CLM-2026-0041", workshop: "AutoPro Workshop", vehicle: "CD-56-78 \u2022 Nissan NP300", customer: "Maria Santos", amount: "$685.14", days: 2, priority: "normal" },
    { ref: "CLM-2026-0042", workshop: "MecAngola Talatona", vehicle: "ST-11-22 \u2022 BMW X3", customer: "Total Energies AO", amount: "$4,200.00", days: 1, priority: "high" },
    { ref: "CLM-2026-0043", workshop: "AutoPro Workshop", vehicle: "UV-33-44 \u2022 Toyota Land Cruiser", customer: "Sonangol Fleet", amount: "$2,890.00", days: 3, priority: "sla" },
    { ref: "CLM-2026-0044", workshop: "QuickFix Luanda", vehicle: "WX-55-66 \u2022 Hyundai Tucson", customer: "Ana Ferreira", amount: "$920.00", days: 0, priority: "normal" },
  ];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div><h2 style={{ margin: 0, fontSize: 22 }}>Claims Queue</h2><p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 14 }}>4 claims awaiting review</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Search claims..." style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, fontSize: 13, width: 250 }} />
          <Button variant="ghost">Filter</Button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {tabs.map((t, i) => (
          <button key={t.label} style={{ padding: "6px 14px", borderRadius: 20, border: i === 0 ? "none" : `1px solid ${colors.border}`, background: i === 0 ? t.color : "#fff", color: i === 0 ? "#fff" : colors.text, fontSize: 12, cursor: "pointer" }}>{t.label}</button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {claims.map(c => (
          <Card key={c.ref} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: c.priority === "high" ? `4px solid ${colors.danger}` : c.priority === "sla" ? `4px solid ${colors.warning}` : undefined }}>
            <div style={{ flex: 2 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{c.ref}</span>
                {c.priority === "high" && <Badge color={colors.danger}>High Value</Badge>}
                {c.priority === "sla" && <Badge color={colors.warning}>SLA Warning</Badge>}
              </div>
              <div style={{ fontSize: 13 }}>{c.vehicle}</div>
              <div style={{ fontSize: 12, color: colors.muted }}>{c.workshop} \u2022 {c.customer}</div>
            </div>
            <div style={{ textAlign: "right", flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{c.amount}</div>
              <div style={{ fontSize: 12, color: c.days >= 3 ? colors.danger : colors.muted }}>{c.days === 0 ? "Today" : `${c.days} days ago`}</div>
            </div>
            <div style={{ marginLeft: 16, display: "flex", gap: 6 }}>
              <Button variant="primary" style={{ fontSize: 12 }}>Review</Button>
              <Button variant="ghost" style={{ fontSize: 12 }}>Photos</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const EstimateReviewScreen = () => (
  <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22 }}>Estimate Review \u2014 CLM-2026-0041</h2>
        <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 14 }}>AutoPro Workshop \u2022 CD-56-78 \u2022 Nissan NP300 \u2022 Maria Santos</p>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="danger">Reject All</Button>
        <Button variant="success">Approve All</Button>
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "2.5fr 1fr", gap: 20 }}>
      <div>
        {/* Line-by-line review table */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: colors.accent }}>
                {["Type", "Description", "Qty", "Workshop Rate", "Our Rate", "Diff", "Status", ""].map(h => (
                  <th key={h} style={{ padding: "10px 8px", textAlign: "left", fontSize: 11, color: colors.muted, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { type: "Labour", desc: "Engine diagnostics", qty: "2.0h", wRate: "$45/h", oRate: "$40/h", diff: "+12%", diffColor: colors.warning, status: null },
                { type: "Labour", desc: "Transmission repair", qty: "6.0h", wRate: "$45/h", oRate: "$42/h", diff: "+7%", diffColor: colors.muted, status: null },
                { type: "Parts", desc: "Transmission fluid (5L)", qty: "2", wRate: "$35.00", oRate: "$33.00", diff: "+6%", diffColor: colors.muted, status: null },
                { type: "Parts", desc: "Gasket set", qty: "1", wRate: "$120.00", oRate: "$95.00", diff: "+26%", diffColor: colors.danger, status: "flagged" },
              ].map((l, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${colors.border}`, background: l.status === "flagged" ? "#FEF2F2" : "transparent" }}>
                  <td style={{ padding: "10px 8px" }}><Badge color={l.type === "Labour" ? colors.secondary : colors.warning}>{l.type}</Badge></td>
                  <td style={{ padding: "10px 8px" }}>{l.desc}</td>
                  <td style={{ padding: "10px 8px" }}>{l.qty}</td>
                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>{l.wRate}</td>
                  <td style={{ padding: "10px 8px" }}>{l.oRate}</td>
                  <td style={{ padding: "10px 8px" }}><span style={{ color: l.diffColor, fontWeight: 600 }}>{l.diff}</span></td>
                  <td style={{ padding: "10px 8px" }}>{l.status === "flagged" && <Badge color={colors.danger}>Above Rate</Badge>}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${colors.success}`, background: "#fff", color: colors.success, cursor: "pointer", fontSize: 14 }}>✓</button>
                      <button style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${colors.warning}`, background: "#fff", color: colors.warning, cursor: "pointer", fontSize: 14 }}>✎</button>
                      <button style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${colors.danger}`, background: "#fff", color: colors.danger, cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card style={{ marginTop: 12 }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Assessor Comments</h4>
          <textarea placeholder="Add comment for workshop..." style={{ width: "100%", height: 60, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 8, fontSize: 13, resize: "none", boxSizing: "border-box" }} />
          <Button style={{ marginTop: 8, fontSize: 12 }}>Send Comment</Button>
        </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Card style={{ background: colors.accent }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 14, color: colors.primary }}>Approval Summary</h4>
          <div style={{ fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>Workshop total</span><span style={{ fontWeight: 600 }}>$685.14</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span>Our rate total</span><span style={{ fontWeight: 600 }}>$621.00</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, color: colors.danger }}><span>Difference</span><span style={{ fontWeight: 600 }}>+$64.14 (10.3%)</span></div>
            <div style={{ borderTop: `2px solid ${colors.primary}`, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, marginTop: 8 }}><span>Approved</span><span>$0.00</span></div>
            <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>Review each line to build the approved total</div>
          </div>
        </Card>

        <Card>
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Damage Photos (6)</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {["Front", "Rear", "Left", "Right", "Close-up 1", "Close-up 2"].map(p => (
              <div key={p} style={{ height: 60, background: colors.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: colors.muted }}>{p}</div>
            ))}
          </div>
        </Card>

        <Card>
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Policy Details</h4>
          <div style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4 }}><span style={{ color: colors.muted }}>Policy #:</span> AO-INS-2024-5567</div>
            <div style={{ marginBottom: 4 }}><span style={{ color: colors.muted }}>Insured:</span> Maria Santos</div>
            <div style={{ marginBottom: 4 }}><span style={{ color: colors.muted }}>Excess:</span> $150.00</div>
            <div><span style={{ color: colors.muted }}>Coverage:</span> Comprehensive</div>
          </div>
        </Card>
      </div>
    </div>
  </div>
);

const MonitoringScreen = () => (
  <div>
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ margin: 0, fontSize: 22 }}>Repair Monitoring</h2>
      <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 14 }}>5 active repairs in progress</p>
    </div>
    {[
      { ref: "CLM-2026-0035", workshop: "AutoPro Workshop", vehicle: "AB-12-34 \u2022 Toyota Hilux", progress: 75, milestone: "Pre-paint photos uploaded", days: 5 },
      { ref: "CLM-2026-0038", workshop: "MecAngola", vehicle: "FG-88-99 \u2022 Mercedes C200", progress: 40, milestone: "Disassembly complete", days: 3 },
      { ref: "CLM-2026-0039", workshop: "QuickFix", vehicle: "HI-22-33 \u2022 Kia Sportage", progress: 15, milestone: "Parts ordered", days: 2 },
    ].map(r => (
      <Card key={r.ref} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{r.ref}</span>
            <span style={{ fontSize: 12, color: colors.muted, marginLeft: 8 }}>{r.workshop}</span>
          </div>
          <span style={{ fontSize: 12, color: colors.muted }}>Day {r.days}</span>
        </div>
        <div style={{ fontSize: 13, marginBottom: 8 }}>{r.vehicle}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ flex: 1, height: 8, background: colors.border, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${r.progress}%`, height: "100%", background: r.progress >= 75 ? colors.success : colors.secondary, borderRadius: 4 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{r.progress}%</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: colors.muted }}>Latest: {r.milestone}</span>
          <Button variant="ghost" style={{ padding: "4px 10px", fontSize: 11 }}>View Photos</Button>
        </div>
      </Card>
    ))}
  </div>
);

const AnalyticsScreen = () => (
  <div>
    <h2 style={{ margin: "0 0 20px", fontSize: 22 }}>Claims Analytics</h2>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
      {[
        { label: "Avg. Approval Time", value: "38h", sub: "Target: 48h", color: colors.success },
        { label: "Approval Rate", value: "87%", sub: "This month", color: colors.secondary },
        { label: "Avg. Claim Value", value: "$1,240", sub: "Up 8% from last month", color: colors.primary },
        { label: "Active Claims", value: "9", sub: "4 new, 5 in repair", color: colors.warning },
      ].map(s => (
        <Card key={s.label}>
          <div style={{ fontSize: 12, color: colors.muted }}>{s.label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
          <div style={{ fontSize: 11, color: colors.muted }}>{s.sub}</div>
        </Card>
      ))}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card>
        <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>Top Workshops (by claim volume)</h4>
        {[
          { name: "AutoPro Workshop", claims: 12, avg: "$980", score: "4.2/5" },
          { name: "MecAngola Talatona", claims: 8, avg: "$1,450", score: "3.8/5" },
          { name: "QuickFix Luanda", claims: 5, avg: "$720", score: "4.5/5" },
        ].map((w, i) => (
          <div key={w.name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
            <div><span style={{ fontWeight: 600 }}>{i + 1}. {w.name}</span><div style={{ fontSize: 11, color: colors.muted }}>{w.claims} claims \u2022 Avg: {w.avg}</div></div>
            <Badge color={parseFloat(w.score) >= 4 ? colors.success : colors.warning}>{w.score}</Badge>
          </div>
        ))}
      </Card>
      <Card>
        <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>Fraud Indicators</h4>
        {[
          { flag: "Gasket set 26% above rate card", claim: "CLM-2026-0041", severity: "Medium" },
          { flag: "Duplicate vehicle in last 60 days", claim: "CLM-2026-0039", severity: "Low" },
        ].map((f, i) => (
          <div key={i} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.border}`, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{f.flag}</span>
              <Badge color={f.severity === "Medium" ? colors.warning : colors.muted}>{f.severity}</Badge>
            </div>
            <div style={{ fontSize: 11, color: colors.muted }}>{f.claim}</div>
          </div>
        ))}
        <div style={{ marginTop: 8, fontSize: 12, color: colors.success }}>No high-severity flags this month</div>
      </Card>
    </div>
  </div>
);

// ── MAIN ──────────────────────────────────────────────────────────

const screenMap = { claims: ClaimsQueueScreen, review: EstimateReviewScreen, monitoring: MonitoringScreen, analytics: AnalyticsScreen };

export default function InsurancePortal() {
  const [screen, setScreen] = useState("claims");
  const Screen = screenMap[screen];
  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: colors.bg, minHeight: "100vh" }}>
      <PortalNav active={screen} onNavigate={setScreen} />
      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <Screen />
      </div>
    </div>
  );
}
