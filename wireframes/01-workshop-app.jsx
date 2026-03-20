import { useState } from "react";

const colors = {
  primary: "#1F4E79",
  secondary: "#2E75B6",
  accent: "#E8F0FE",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  bg: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#1E293B",
  muted: "#94A3B8",
};

const Badge = ({ children, color = colors.secondary }) => (
  <span style={{ background: color, color: "#fff", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }}>{children}</span>
);

const Card = ({ children, style }) => (
  <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 16, ...style }}>{children}</div>
);

const Button = ({ children, variant = "primary", onClick, style }) => {
  const base = { padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 };
  const styles = {
    primary: { ...base, background: colors.primary, color: "#fff" },
    secondary: { ...base, background: colors.accent, color: colors.primary },
    success: { ...base, background: colors.success, color: "#fff" },
    danger: { ...base, background: colors.danger, color: "#fff" },
    ghost: { ...base, background: "transparent", color: colors.primary, border: `1px solid ${colors.border}` },
  };
  return <button style={{ ...styles[variant], ...style }} onClick={onClick}>{children}</button>;
};

const Input = ({ label, placeholder, type = "text", style }) => (
  <div style={{ marginBottom: 12, ...style }}>
    <label style={{ fontSize: 12, color: colors.muted, marginBottom: 4, display: "block" }}>{label}</label>
    <input type={type} placeholder={placeholder} style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, fontSize: 14, boxSizing: "border-box" }} />
  </div>
);

const Select = ({ label, options, style }) => (
  <div style={{ marginBottom: 12, ...style }}>
    <label style={{ fontSize: 12, color: colors.muted, marginBottom: 4, display: "block" }}>{label}</label>
    <select style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, fontSize: 14, boxSizing: "border-box", background: "#fff" }}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  </div>
);

const Toggle = ({ label, defaultChecked }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
    <div style={{ width: 40, height: 22, borderRadius: 11, background: defaultChecked ? colors.primary : colors.border, position: "relative", cursor: "pointer" }}>
      <div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 2, left: defaultChecked ? 20 : 2, transition: "left 0.2s" }} />
    </div>
    <span style={{ fontSize: 13 }}>{label}</span>
  </div>
);

const Sidebar = ({ active, onNavigate }) => {
  const sections = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "jobcards", icon: "📋", label: "Job Cards" },
    { id: "jobcreate", icon: "➕", label: "Create Job Card" },
    { id: "jobdetail", icon: "📄", label: "Job Card Detail" },
    { id: "customers", icon: "👥", label: "Customers" },
    { id: "vehicles", icon: "🚗", label: "Vehicles" },
    { id: "parts", icon: "🔧", label: "Parts & Inventory" },
    { id: "invoices", icon: "💰", label: "Invoices" },
    { id: "expenses", icon: "📑", label: "Expenses" },
    { id: "schedule", icon: "📅", label: "Schedule" },
    { id: "settings", icon: "⚙️", label: "Settings" },
  ];
  return (
    <div style={{ width: 220, background: colors.primary, color: "#fff", padding: "20px 0", minHeight: "100vh", flexShrink: 0 }}>
      <div style={{ padding: "0 20px 24px", fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>MECANIX</div>
      {sections.map(s => (
        <div key={s.id} onClick={() => onNavigate(s.id)}
          style={{ padding: "10px 20px", cursor: "pointer", background: active === s.id ? "rgba(255,255,255,0.15)" : "transparent", display: "flex", alignItems: "center", gap: 10, fontSize: 14, borderLeft: active === s.id ? "3px solid #fff" : "3px solid transparent" }}>
          <span>{s.icon}</span>{s.label}
        </div>
      ))}
    </div>
  );
};

const Header = ({ title, subtitle, actions }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
    <div>
      <h1 style={{ fontSize: 24, margin: 0, color: colors.text }}>{title}</h1>
      {subtitle && <p style={{ margin: "4px 0 0", color: colors.muted, fontSize: 14 }}>{subtitle}</p>}
    </div>
    <div style={{ display: "flex", gap: 8 }}>{actions}</div>
  </div>
);

// ── SCREENS ───────────────────────────────────────────────────────

const DashboardScreen = () => {
  const stats = [
    { label: "Open Jobs", value: "23", color: colors.secondary },
    { label: "Revenue (This Month)", value: "$12,450", color: colors.success },
    { label: "Total Receivables", value: "$3,200", sub: "$800 overdue", color: colors.warning },
    { label: "Total Payables", value: "$1,890", sub: "$0 overdue", color: colors.danger },
  ];
  const kanban = [
    { status: "Received", count: 5, color: "#94A3B8" },
    { status: "Diagnosing", count: 3, color: "#F59E0B" },
    { status: "Awaiting Approval", count: 4, color: "#8B5CF6" },
    { status: "In Progress", count: 8, color: "#3B82F6" },
    { status: "Awaiting Parts", count: 2, color: "#EF4444" },
    { status: "Ready", count: 1, color: "#22C55E" },
  ];
  return (
    <div>
      <Header title="Dashboard" subtitle="Workshop overview \u2014 Today, 12 March 2026" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        {stats.map(s => (
          <Card key={s.label}>
            <div style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 11, color: colors.danger, marginTop: 2 }}>{s.sub}</div>}
          </Card>
        ))}
      </div>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>Jobs by Status</h3>
      <div style={{ display: "flex", gap: 12, marginBottom: 24, overflowX: "auto" }}>
        {kanban.map(k => (
          <div key={k.status} style={{ minWidth: 160, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 12, borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{k.status}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.count}</div>
            <div style={{ fontSize: 11, color: colors.muted }}>job cards</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card>
          <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>Income vs Expense (2026)</h4>
          <div style={{ display: "flex", alignItems: "flex-end", height: 120, gap: 8 }}>
            {["Jan", "Feb", "Mar"].map((m, i) => (
              <div key={m} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ display: "flex", gap: 2, justifyContent: "center", alignItems: "flex-end", height: 100 }}>
                  <div style={{ width: 16, background: colors.secondary, borderRadius: "4px 4px 0 0", height: [60, 80, 95][i] }} />
                  <div style={{ width: 16, background: colors.warning, borderRadius: "4px 4px 0 0", height: [40, 55, 50][i] }} />
                </div>
                <div style={{ fontSize: 11, marginTop: 4, color: colors.muted }}>{m}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12 }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: colors.secondary, borderRadius: 2, marginRight: 4 }} />Income</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: colors.warning, borderRadius: 2, marginRight: 4 }} />Expense</span>
          </div>
        </Card>
        <Card>
          <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>Low Stock Alerts</h4>
          {["Oil Filter (3 left)", "Brake Pads Set (1 left)", "Air Filter (2 left)"].map(p => (
            <div key={p} style={{ padding: "6px 0", borderBottom: `1px solid ${colors.border}`, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
              <span>{p}</span>
              <Badge color={colors.danger}>Low</Badge>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
};

const JobCardListScreen = () => {
  const tabs = ["All (23)", "Draft (2)", "Check In (3)", "In Progress (8)", "Awaiting Parts (2)", "Ready (1)", "Delivered (7)"];
  const jobs = [
    { id: "JC-001", vehicle: "AB-12-34 \u2022 Toyota Hilux", customer: "Carlos Mendes", tech: "Paulo", status: "In Progress", amount: "$320", insurance: false },
    { id: "JC-002", vehicle: "CD-56-78 \u2022 Nissan NP300", customer: "Maria Santos", tech: "Joao", status: "Awaiting Approval", amount: "$1,250", insurance: true },
    { id: "JC-003", vehicle: "EF-90-12 \u2022 Honda Civic", customer: "Angola Oil Corp", tech: "Paulo", status: "Diagnosing", amount: "TBD", insurance: false },
    { id: "JC-004", vehicle: "GH-34-56 \u2022 Isuzu D-Max", customer: "Pedro Fernandes", tech: "\u2014", status: "Received", amount: "TBD", insurance: true },
    { id: "JC-005", vehicle: "IJ-78-90 \u2022 VW Amarok", customer: "Fleet Services Ltd", tech: "Miguel", status: "Ready", amount: "$890", insurance: false },
  ];
  const statusColor = { "In Progress": "#3B82F6", "Awaiting Approval": "#8B5CF6", "Diagnosing": "#F59E0B", "Received": "#94A3B8", "Ready": "#22C55E" };
  return (
    <div>
      <Header title="Job Cards" subtitle="All work orders" actions={<Button>+ Create Job Card</Button>} />
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {tabs.map((t, i) => (
          <button key={t} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${colors.border}`, background: i === 0 ? colors.primary : "#fff", color: i === 0 ? "#fff" : colors.text, fontSize: 12, cursor: "pointer" }}>{t}</button>
        ))}
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: colors.accent }}>
              {["Job #", "Vehicle", "Customer", "Technician", "Status", "Amount", ""].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 12, color: colors.muted }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map(j => (
              <tr key={j.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{j.id} {j.insurance && <span title="Insurance Job" style={{ fontSize: 10 }}>🛡️</span>}</td>
                <td style={{ padding: "10px 12px" }}>{j.vehicle}</td>
                <td style={{ padding: "10px 12px" }}>{j.customer}</td>
                <td style={{ padding: "10px 12px" }}>{j.tech}</td>
                <td style={{ padding: "10px 12px" }}><Badge color={statusColor[j.status] || colors.muted}>{j.status}</Badge></td>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{j.amount}</td>
                <td style={{ padding: "10px 12px" }}><Button variant="ghost" style={{ padding: "4px 10px", fontSize: 12 }}>View</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const JobCardCreateScreen = () => (
  <div>
    <Header title="Create Job Card" subtitle="New work order" />
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
      <Card>
        <h3 style={{ fontSize: 16, margin: "0 0 16px" }}>Job Details</h3>
        <Input label="Title" placeholder="e.g. Full service, Brake replacement" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Select label="Customer *" options={["Select customer...", "Carlos Mendes", "Maria Santos", "Angola Oil Corp"]} />
          <Select label="Vehicle *" options={["Select vehicle...", "AB-12-34 \u2022 Toyota Hilux", "CD-56-78 \u2022 Nissan NP300"]} />
        </div>
        <div style={{ margin: "12px 0", padding: 12, background: colors.accent, borderRadius: 8 }}>
          <Toggle label="Insurance Job" defaultChecked={false} />
          <div style={{ fontSize: 11, color: colors.muted, marginLeft: 48 }}>Enable to add insurance type, insurer, and policy details</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Input label="Order Date" type="date" />
          <Input label="Order #" placeholder="JC-000006" />
          <Input label="Estimate #" placeholder="EST-000006" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Select label="Service Writer *" options={["Elie Ewaz", "Raja"]} />
          <Select label="Primary Technician" options={["Select...", "Paulo Silva", "Joao Costa", "Miguel Dias"]} />
        </div>
        <Input label="Reported Problem" placeholder="Customer describes the issue..." />
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <Toggle label="Digital Authorisation" defaultChecked={true} />
          <Toggle label="Parts Issuing (Manual)" defaultChecked={false} />
          <Toggle label="Taxable" defaultChecked={true} />
        </div>
      </Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card>
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Customer Remark</h4>
          <textarea style={{ width: "100%", height: 60, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box" }} placeholder="Notes visible on estimates..." />
        </Card>
        <Card>
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Labels</h4>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {["Urgent", "Fleet", "Warranty", "Insurance"].map(l => (
              <span key={l} style={{ padding: "4px 10px", borderRadius: 12, border: `1px solid ${colors.border}`, fontSize: 12, cursor: "pointer" }}>{l}</span>
            ))}
          </div>
        </Card>
        <Card>
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Estimate Footer (T&Cs)</h4>
          <textarea style={{ width: "100%", height: 80, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 8, fontSize: 11, color: colors.muted, resize: "vertical", boxSizing: "border-box" }} defaultValue="Payment Terms: A 60% advance payment is required..." />
        </Card>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost">Save as Draft</Button>
          <Button variant="success">Check In</Button>
        </div>
      </div>
    </div>
  </div>
);

const JobCardDetailScreen = () => (
  <div>
    <Header title="JC-002 \u2014 Nissan NP300" subtitle="Maria Santos \u2022 CD-56-78" actions={
      <><Badge color="#8B5CF6">Awaiting Approval</Badge><span style={{ width: 8 }} /><Badge color={colors.secondary}>🛡️ Insurance</Badge></>
    } />
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card>
          <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>Labour Lines</h4>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${colors.border}` }}>{["Description", "Technician", "Hours", "Rate", "Total"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 12, color: colors.muted }}>{h}</th>)}</tr></thead>
            <tbody>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}><td style={{ padding: "8px" }}>Engine diagnostics</td><td>Joao</td><td>2.0h</td><td>$45/h</td><td style={{ fontWeight: 600 }}>$90.00</td></tr>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}><td style={{ padding: "8px" }}>Transmission repair</td><td>Joao</td><td>6.0h</td><td>$45/h</td><td style={{ fontWeight: 600 }}>$270.00</td></tr>
              <tr><td style={{ padding: "8px" }} colSpan={4}><Button variant="ghost" style={{ fontSize: 12 }}>+ Add Labour Line</Button></td><td style={{ fontWeight: 700 }}>$360.00</td></tr>
            </tbody>
          </table>
        </Card>
        <Card>
          <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>Parts Lines</h4>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${colors.border}` }}>{["Part", "Qty", "Unit Cost", "Markup", "Total"].map(h => <th key={h} style={{ textAlign: "left", padding: "6px 8px", fontSize: 12, color: colors.muted }}>{h}</th>)}</tr></thead>
            <tbody>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}><td style={{ padding: "8px" }}>Transmission fluid (5L)</td><td>2</td><td>$35.00</td><td>30%</td><td style={{ fontWeight: 600 }}>$91.00</td></tr>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}><td style={{ padding: "8px" }}>Gasket set</td><td>1</td><td>$120.00</td><td>25%</td><td style={{ fontWeight: 600 }}>$150.00</td></tr>
              <tr><td style={{ padding: "8px" }} colSpan={4}><Button variant="ghost" style={{ fontSize: 12 }}>+ Add Part</Button></td><td style={{ fontWeight: 700 }}>$241.00</td></tr>
            </tbody>
          </table>
        </Card>
        <Card>
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Photos</h4>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3].map(i => <div key={i} style={{ width: 80, height: 80, background: colors.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: colors.muted, fontSize: 12 }}>Photo {i}</div>)}
            <div style={{ width: 80, height: 80, background: colors.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, cursor: "pointer", border: `2px dashed ${colors.border}` }}>+</div>
          </div>
        </Card>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card style={{ background: colors.accent }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 14, color: colors.primary }}>Summary</h4>
          <div style={{ fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Labour</span><span>$360.00</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>Parts</span><span>$241.00</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span>IVA (14%)</span><span>$84.14</span></div>
            <div style={{ borderTop: `2px solid ${colors.primary}`, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}><span>Total</span><span>$685.14</span></div>
            <div style={{ marginTop: 8, fontSize: 12, color: colors.muted }}>Insurance: $535.14 \u2022 Customer excess: $150.00</div>
          </div>
        </Card>
        <Card>
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Status History</h4>
          {[
            { status: "Received", time: "10 Mar, 09:15", by: "Reception" },
            { status: "Diagnosing", time: "10 Mar, 10:30", by: "Joao" },
            { status: "Awaiting Approval", time: "10 Mar, 14:00", by: "System" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: `1px solid ${colors.border}`, fontSize: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: colors.secondary, marginTop: 4 }} />
              <div><div style={{ fontWeight: 600 }}>{s.status}</div><div style={{ color: colors.muted }}>{s.time} \u2022 {s.by}</div></div>
            </div>
          ))}
        </Card>
        <Card>
          <h4 style={{ margin: "0 0 8px", fontSize: 14 }}>Actions</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button variant="primary" style={{ width: "100%" }}>Send Quote to Customer</Button>
            <Button variant="secondary" style={{ width: "100%" }}>Submit to Insurer</Button>
            <Button variant="ghost" style={{ width: "100%" }}>Generate PDF Estimate</Button>
          </div>
        </Card>
      </div>
    </div>
  </div>
);

const CustomersScreen = () => (
  <div>
    <Header title="Customers" subtitle="Manage customer records" actions={<Button>+ New Customer</Button>} />
    <div style={{ marginBottom: 16 }}><input placeholder="Search by name, phone, or tax ID..." style={{ width: 400, padding: "8px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, fontSize: 14 }} /></div>
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: colors.accent }}>{["Name", "Phone", "Tax ID", "Vehicles", "Last Visit", "Total Spent", ""].map(h => <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, color: colors.muted }}>{h}</th>)}</tr></thead>
        <tbody>
          {[
            { name: "Carlos Mendes", phone: "+244 923 456 789", tax: "NIF 1234567890", vehicles: 2, last: "8 Mar 2026", spent: "$2,340" },
            { name: "Maria Santos", phone: "+244 912 345 678", tax: "NIF 0987654321", vehicles: 1, last: "10 Mar 2026", spent: "$685" },
            { name: "Angola Oil Corp", phone: "+244 222 334 455", tax: "NIF 5555666677", vehicles: 8, last: "11 Mar 2026", spent: "$18,900" },
            { name: "Pedro Fernandes", phone: "+244 934 567 890", tax: "NIF 1112223334", vehicles: 1, last: "12 Mar 2026", spent: "$0" },
          ].map(c => (
            <tr key={c.name} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <td style={{ padding: "10px 12px", fontWeight: 600 }}>{c.name}</td>
              <td style={{ padding: "10px 12px" }}>{c.phone}</td>
              <td style={{ padding: "10px 12px", fontSize: 12 }}>{c.tax}</td>
              <td style={{ padding: "10px 12px" }}>{c.vehicles}</td>
              <td style={{ padding: "10px 12px" }}>{c.last}</td>
              <td style={{ padding: "10px 12px", fontWeight: 600 }}>{c.spent}</td>
              <td style={{ padding: "10px 12px" }}><Button variant="ghost" style={{ padding: "4px 10px", fontSize: 12 }}>View</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </div>
);

const VehiclesScreen = () => (
  <div>
    <Header title="Vehicles" subtitle="Vehicle registry" actions={<Button>+ Register Vehicle</Button>} />
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: colors.accent }}>{["Plate", "Make / Model", "Year", "Owner", "Mileage", "Last Service", ""].map(h => <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, color: colors.muted }}>{h}</th>)}</tr></thead>
        <tbody>
          {[
            { plate: "AB-12-34", car: "Toyota Hilux 2.8 D4D", year: 2021, owner: "Carlos Mendes", km: "67,500 km", last: "8 Mar 2026" },
            { plate: "CD-56-78", car: "Nissan NP300 2.5 TDi", year: 2019, owner: "Maria Santos", km: "112,000 km", last: "10 Mar 2026" },
            { plate: "EF-90-12", car: "Honda Civic 1.5T", year: 2023, owner: "Angola Oil Corp", km: "23,400 km", last: "11 Mar 2026" },
          ].map(v => (
            <tr key={v.plate} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <td style={{ padding: "10px 12px", fontWeight: 700, fontFamily: "monospace" }}>{v.plate}</td>
              <td style={{ padding: "10px 12px" }}>{v.car}</td>
              <td style={{ padding: "10px 12px" }}>{v.year}</td>
              <td style={{ padding: "10px 12px" }}>{v.owner}</td>
              <td style={{ padding: "10px 12px" }}>{v.km}</td>
              <td style={{ padding: "10px 12px" }}>{v.last}</td>
              <td style={{ padding: "10px 12px" }}><Button variant="ghost" style={{ padding: "4px 10px", fontSize: 12 }}>History</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </div>
);

const PartsScreen = () => (
  <div>
    <Header title="Parts & Inventory" subtitle="Stock management" actions={<><Button variant="ghost">Service Groups</Button><Button>+ Add Part</Button></>} />
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: colors.accent }}>{["Part #", "Description", "Stock", "Cost", "Sell Price", "Supplier", "Status"].map(h => <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, color: colors.muted }}>{h}</th>)}</tr></thead>
        <tbody>
          {[
            { num: "OIL-5W30", desc: "Engine Oil 5W-30 (5L)", stock: 12, cost: "$18", sell: "$28", supplier: "LuandaOil", status: "OK" },
            { num: "BRK-PAD-F", desc: "Front Brake Pads Set", stock: 1, cost: "$25", sell: "$45", supplier: "AutoParts AO", status: "Low" },
            { num: "FLT-AIR", desc: "Air Filter (Universal)", stock: 2, cost: "$8", sell: "$15", supplier: "AutoParts AO", status: "Low" },
            { num: "FLT-OIL", desc: "Oil Filter", stock: 3, cost: "$6", sell: "$12", supplier: "LuandaOil", status: "Low" },
            { num: "TRN-FLD", desc: "Transmission Fluid (1L)", stock: 20, cost: "$12", sell: "$20", supplier: "LuandaOil", status: "OK" },
          ].map(p => (
            <tr key={p.num} style={{ borderBottom: `1px solid ${colors.border}`, background: p.status === "Low" ? "#FEF2F2" : "transparent" }}>
              <td style={{ padding: "10px 12px", fontFamily: "monospace", fontWeight: 600 }}>{p.num}</td>
              <td style={{ padding: "10px 12px" }}>{p.desc}</td>
              <td style={{ padding: "10px 12px", fontWeight: 600 }}>{p.stock}</td>
              <td style={{ padding: "10px 12px" }}>{p.cost}</td>
              <td style={{ padding: "10px 12px" }}>{p.sell}</td>
              <td style={{ padding: "10px 12px" }}>{p.supplier}</td>
              <td style={{ padding: "10px 12px" }}><Badge color={p.status === "Low" ? colors.danger : colors.success}>{p.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </div>
);

const InvoicesScreen = () => (
  <div>
    <Header title="Invoices" subtitle="Billing & payments" actions={<><Button variant="ghost">Credit Notes</Button><Button>+ Create Invoice</Button></>} />
    <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
      {["All (18)", "Draft (2)", "Sent (5)", "Paid (8)", "Overdue (3)"].map((t, i) => (
        <button key={t} style={{ padding: "6px 14px", borderRadius: 20, border: `1px solid ${colors.border}`, background: i === 0 ? colors.primary : "#fff", color: i === 0 ? "#fff" : colors.text, fontSize: 12, cursor: "pointer" }}>{t}</button>
      ))}
    </div>
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: colors.accent }}>{["Invoice #", "Customer", "Job Card", "Date", "Amount", "Status", ""].map(h => <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, color: colors.muted }}>{h}</th>)}</tr></thead>
        <tbody>
          {[
            { num: "INV-001", customer: "Carlos Mendes", job: "JC-001", date: "8 Mar", amount: "$320.00", status: "Paid" },
            { num: "INV-002", customer: "Maria Santos", job: "JC-002", date: "10 Mar", amount: "$685.14", status: "Sent" },
            { num: "INV-003", customer: "Angola Oil Corp", job: "JC-003", date: "5 Mar", amount: "$1,200.00", status: "Overdue" },
          ].map(inv => (
            <tr key={inv.num} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <td style={{ padding: "10px 12px", fontWeight: 600 }}>{inv.num}</td>
              <td style={{ padding: "10px 12px" }}>{inv.customer}</td>
              <td style={{ padding: "10px 12px" }}>{inv.job}</td>
              <td style={{ padding: "10px 12px" }}>{inv.date}</td>
              <td style={{ padding: "10px 12px", fontWeight: 600 }}>{inv.amount}</td>
              <td style={{ padding: "10px 12px" }}><Badge color={inv.status === "Paid" ? colors.success : inv.status === "Overdue" ? colors.danger : colors.warning}>{inv.status}</Badge></td>
              <td style={{ padding: "10px 12px" }}><Button variant="ghost" style={{ padding: "4px 10px", fontSize: 12 }}>View</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </div>
);

const ExpensesScreen = () => (
  <div>
    <Header title="Expenses" subtitle="Workshop operating costs" actions={<Button>+ Add Expense</Button>} />
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: colors.accent }}>{["Date", "Category", "Description", "Amount", "Receipt", ""].map(h => <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, color: colors.muted }}>{h}</th>)}</tr></thead>
        <tbody>
          {[
            { date: "11 Mar", cat: "Rent", desc: "Workshop rent - March", amount: "$2,500", receipt: true },
            { date: "9 Mar", cat: "Utilities", desc: "Electricity bill", amount: "$340", receipt: true },
            { date: "7 Mar", cat: "Tools", desc: "Torque wrench replacement", amount: "$85", receipt: false },
          ].map((e, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <td style={{ padding: "10px 12px" }}>{e.date}</td>
              <td style={{ padding: "10px 12px" }}><Badge color={colors.secondary}>{e.cat}</Badge></td>
              <td style={{ padding: "10px 12px" }}>{e.desc}</td>
              <td style={{ padding: "10px 12px", fontWeight: 600 }}>{e.amount}</td>
              <td style={{ padding: "10px 12px" }}>{e.receipt ? "📎 Attached" : <span style={{ color: colors.muted }}>None</span>}</td>
              <td style={{ padding: "10px 12px" }}><Button variant="ghost" style={{ padding: "4px 10px", fontSize: 12 }}>Edit</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </div>
);

const ScheduleScreen = () => {
  const techs = [
    { name: "Paulo Silva", jobs: [{ time: "08:00", vehicle: "AB-12-34", task: "Full service", status: "working" }, { time: "11:00", vehicle: "KL-23-45", task: "Oil change", status: "next" }] },
    { name: "Joao Costa", jobs: [{ time: "08:00", vehicle: "CD-56-78", task: "Transmission repair", status: "working" }] },
    { name: "Miguel Dias", jobs: [{ time: "09:00", vehicle: "IJ-78-90", task: "Brake pads", status: "complete" }, { time: "13:00", vehicle: "MN-45-67", task: "AC repair", status: "next" }] },
  ];
  const statusStyle = { working: { bg: "#DCFCE7", border: "#22C55E" }, next: { bg: "#FEF3C7", border: "#F59E0B" }, complete: { bg: "#F1F5F9", border: "#94A3B8" } };
  return (
    <div>
      <Header title="Daily Schedule" subtitle="Today, 12 March 2026 \u2022 3 technicians \u2022 4 bays" />
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {techs.map(t => (
          <Card key={t.name}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: colors.primary, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>{t.name[0]}</div>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <Badge color={colors.success}>Active</Badge>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              {t.jobs.map((j, i) => (
                <div key={i} style={{ flex: 1, padding: 12, borderRadius: 8, background: statusStyle[j.status].bg, borderLeft: `3px solid ${statusStyle[j.status].border}` }}>
                  <div style={{ fontSize: 11, color: colors.muted }}>{j.time}</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{j.vehicle}</div>
                  <div style={{ fontSize: 12 }}>{j.task}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const SettingsScreen = () => (
  <div>
    <Header title="Settings" subtitle="Workshop configuration" />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      {[
        { icon: "🏢", title: "Company Profile", desc: "Workshop name, logo, address, contact details" },
        { icon: "💱", title: "Tax & Rates", desc: "IVA rate, tax ID, invoice numbering prefix" },
        { icon: "🌍", title: "Language & Currency", desc: "pt-PT, pt-BR, English \u2022 AOA, USD, MZN, BRL" },
        { icon: "📱", title: "WhatsApp Templates", desc: "Message templates for automated notifications" },
        { icon: "👥", title: "User Management", desc: "Staff accounts, roles, permissions" },
        { icon: "🔧", title: "Workshop Config", desc: "Number of bays, working hours, holidays" },
        { icon: "📄", title: "Estimate Templates", desc: "Default T&Cs, payment terms footer" },
        { icon: "🔗", title: "Integrations", desc: "WhatsApp API, payment providers, accounting" },
      ].map(s => (
        <Card key={s.title} style={{ cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ fontSize: 28 }}>{s.icon}</div>
          <div><div style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</div><div style={{ fontSize: 12, color: colors.muted }}>{s.desc}</div></div>
        </Card>
      ))}
    </div>
  </div>
);

// ── MAIN APP ──────────────────────────────────────────────────────

const screens = {
  dashboard: DashboardScreen,
  jobcards: JobCardListScreen,
  jobcreate: JobCardCreateScreen,
  jobdetail: JobCardDetailScreen,
  customers: CustomersScreen,
  vehicles: VehiclesScreen,
  parts: PartsScreen,
  invoices: InvoicesScreen,
  expenses: ExpensesScreen,
  schedule: ScheduleScreen,
  settings: SettingsScreen,
};

export default function WorkshopApp() {
  const [screen, setScreen] = useState("dashboard");
  const Screen = screens[screen] || DashboardScreen;
  return (
    <div style={{ display: "flex", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: colors.bg, minHeight: "100vh" }}>
      <Sidebar active={screen} onNavigate={setScreen} />
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        <Screen />
      </div>
    </div>
  );
}
