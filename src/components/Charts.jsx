import React, { useMemo, useState } from "react";

/* =============================================================================
   Charts.jsx — hand-rolled SVG charts, zero dependencies.
   -----------------------------------------------------------------------------
   Deliberately not using recharts/chart.js: adding a chart library to this
   project means another npm install and another version to keep aligned.
   These cover the dashboard's needs (donut, bar, area, sparkline) in ~250 lines
   and inherit the GIVT palette passed in from the parent.
   ========================================================================== */

const C = {
  ink: "#0E1116", inkSoft: "#2A2F3A", muted: "#6B7280",
  paper: "#F7F3EC", paperWarm: "#EFE7D6", rule: "#D8CFBE",
  gold: "#B8862F", teal: "#2D6E6A", rust: "#A04A1E", green: "#1F7A3A", blue: "#3B5BA5",
};

export const ROLE_COLORS = {
  Student: "#3B5BA5",
  Professor: "#2D6E6A",
  Advisor: "#A04A1E",
  Employer: "#B8862F",
  Admin: "#6D28D9",
};

/* ------------------------------------------------------------------ Donut */
export function DonutChart({ data, size = 220, thickness = 30, title }) {
  const [hover, setHover] = useState(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const segments = data.map((d) => {
    const fraction = total ? d.value / total : 0;
    const seg = { ...d, fraction, dash: fraction * circumference, offset };
    offset += fraction * circumference;
    return seg;
  });

  const active = hover !== null ? segments[hover] : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.paperWarm} strokeWidth={thickness} />
          {segments.map((s, i) => (
            <circle
              key={s.label}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={hover === i ? thickness + 6 : thickness}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset}
              style={{ transition: "stroke-width .15s ease", cursor: "pointer" }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", pointerEvents: "none",
        }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: C.ink, lineHeight: 1 }}>
            {active ? active.value : total}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 4, textTransform: "uppercase", letterSpacing: .6 }}>
            {active ? active.label : title || "Total"}
          </div>
          {active && (
            <div style={{ fontSize: 12, color: active.color, fontWeight: 600, marginTop: 2 }}>
              {(active.fraction * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 150 }}>
        {segments.map((s, i) => (
          <div
            key={s.label}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{
              display: "flex", alignItems: "center", gap: 9, cursor: "pointer",
              opacity: hover === null || hover === i ? 1 : 0.45, transition: "opacity .15s",
            }}
          >
            <span style={{ width: 11, height: 11, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: C.inkSoft, flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{s.value}</span>
            <span style={{ fontSize: 11, color: C.muted, width: 42, textAlign: "right" }}>
              {total ? ((s.value / total) * 100).toFixed(0) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Bar chart */
export function BarChart({ data, height = 240, showValues = true }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 100 / (data.length * 1.6);
  const gap = barW * 0.6;

  // Round the axis ceiling up to something readable.
  const step = Math.max(1, Math.ceil(max / 4));
  const ceiling = step * 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);

  return (
    <div style={{ position: "relative", height, paddingLeft: 34, paddingBottom: 26, paddingTop: 8 }}>
      {/* y-axis grid */}
      {ticks.map((t) => {
        const y = 100 - (t / ceiling) * 100;
        return (
          <div key={t} style={{ position: "absolute", left: 0, right: 0, top: `${y * 0.82 + 4}%` }}>
            <span style={{
              position: "absolute", left: 0, top: -7, fontSize: 10, color: C.muted, width: 28, textAlign: "right",
            }}>{t}</span>
            <div style={{ marginLeft: 34, borderTop: `1px ${t === 0 ? "solid" : "dashed"} ${C.rule}` }} />
          </div>
        );
      })}

      <div style={{
        position: "absolute", left: 34, right: 0, top: 8, bottom: 26,
        display: "flex", alignItems: "flex-end", justifyContent: "space-around",
      }}>
        {data.map((d, i) => {
          const h = (d.value / ceiling) * 100;
          return (
            <div
              key={d.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "flex-end", height: "100%",
                position: "relative", cursor: "pointer",
              }}
            >
              {showValues && d.value > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color: hover === i ? d.color : C.inkSoft,
                  marginBottom: 3, transition: "color .15s",
                }}>{d.value}</span>
              )}
              <div style={{
                width: "58%", maxWidth: 54,
                height: `${Math.max(h, d.value > 0 ? 1.5 : 0)}%`,
                background: d.color,
                borderRadius: "5px 5px 0 0",
                opacity: hover === null || hover === i ? 1 : 0.5,
                transition: "opacity .15s, filter .15s",
                filter: hover === i ? "brightness(1.1)" : "none",
                minHeight: d.value > 0 ? 3 : 0,
              }} />
              <span style={{
                position: "absolute", bottom: -22, fontSize: 10.5,
                color: hover === i ? C.ink : C.muted, fontWeight: hover === i ? 600 : 400,
                whiteSpace: "nowrap",
              }}>{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Area chart */
export function AreaChart({ data, height = 220, color = C.teal, label = "value", valueKey = "count" }) {
  const [hover, setHover] = useState(null);
  const W = 600;
  const H = height;
  const pad = { top: 14, right: 10, bottom: 26, left: 36 };

  const values = data.map((d) => d[valueKey]);
  const max = Math.max(...values, 1);
  const step = Math.max(1, Math.ceil(max / 4));
  const ceiling = step * 4;

  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const pts = data.map((d, i) => ({
    x: pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
    y: pad.top + innerH - (d[valueKey] / ceiling) * innerH,
    ...d,
  }));

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1]?.x.toFixed(1)},${pad.top + innerH} L${pts[0]?.x.toFixed(1)},${pad.top + innerH} Z`;

  const fmtDate = (iso) => {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  // Show at most ~6 x-axis labels so they never collide.
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3, 4].map((i) => {
          const v = i * step;
          const y = pad.top + innerH - (v / ceiling) * innerH;
          return (
            <g key={i}>
              <line x1={pad.left} y1={y} x2={W - pad.right} y2={y}
                stroke={C.rule} strokeWidth="1" strokeDasharray={i === 0 ? "0" : "3 4"} />
              <text x={pad.left - 7} y={y + 3.5} fontSize="10" fill={C.muted} textAnchor="end">{v}</text>
            </g>
          );
        })}

        {pts.length > 1 && <path d={area} fill={`url(#grad-${label})`} />}
        {pts.length > 1 && <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />}

        {pts.map((p, i) => (
          <g key={i}>
            {i % labelEvery === 0 && (
              <text x={p.x} y={H - 7} fontSize="9.5" fill={C.muted} textAnchor="middle">{fmtDate(p.date)}</text>
            )}
            <circle cx={p.x} cy={p.y} r={hover === i ? 5 : 3}
              fill={hover === i ? color : "#fff"} stroke={color} strokeWidth="2"
              style={{ transition: "r .12s" }} />
            <rect x={p.x - innerW / (data.length * 2)} y={pad.top} width={innerW / data.length} height={innerH}
              fill="transparent" style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          </g>
        ))}
      </svg>

      {hover !== null && pts[hover] && (
        <div style={{
          position: "absolute",
          left: `${(pts[hover].x / W) * 100}%`,
          top: `${(pts[hover].y / H) * 100}%`,
          transform: "translate(-50%, -130%)",
          background: C.ink, color: "#fff", padding: "5px 9px", borderRadius: 6,
          fontSize: 11.5, whiteSpace: "nowrap", pointerEvents: "none", zIndex: 5,
          boxShadow: "0 4px 12px rgba(0,0,0,.18)",
        }}>
          <strong>{pts[hover][valueKey]}</strong> {label} · {fmtDate(pts[hover].date)}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------- Horizontal bars */
export function HBarChart({ data }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {data.map((d) => (
        <div key={d.label}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 12.5, color: C.inkSoft, fontWeight: 500 }}>{d.label}</span>
            <span style={{ fontSize: 12.5, color: C.ink, fontWeight: 600 }}>{d.value}</span>
          </div>
          <div style={{ height: 8, background: C.paperWarm, borderRadius: 4, overflow: "hidden" }}>
            <div style={{
              width: `${(d.value / max) * 100}%`, height: "100%",
              background: d.color, borderRadius: 4, transition: "width .4s ease",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- Sparkline */
export function Sparkline({ data, width = 90, height = 28, color = C.teal, valueKey = "count" }) {
  const values = data.map((d) => d[valueKey]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.8"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export { C as CHART_COLORS };
