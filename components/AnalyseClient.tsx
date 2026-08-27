"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildAnalyticsSeries, type Period } from "@/lib/analytics";

type RawQuest = { completedAt: string; track: "marketing" | "technique" };
type RawCheckIn = { createdAt: string; clients: number; revenue: number; audience: number };

const PERIOD_LABELS: Record<Period, string> = {
  day: "Jour",
  week: "Semaine",
  month: "Mois",
  year: "An",
};

export function AnalyseClient({
  ideaId,
  analysis,
  quests,
  checkIns,
}: {
  ideaId: string;
  analysis: string;
  quests: RawQuest[];
  checkIns: RawCheckIn[];
}) {
  const [period, setPeriod] = useState<Period>("week");

  const series = useMemo(() => {
    const q = quests.map((x) => ({ completedAt: new Date(x.completedAt), track: x.track }));
    const c = checkIns.map((x) => ({ ...x, createdAt: new Date(x.createdAt) }));
    return buildAnalyticsSeries(period, q, c);
  }, [period, quests, checkIns]);

  return (
    <div style={{ position: "relative", zIndex: 2, padding: "0 20px 80px", maxWidth: 720, margin: "0 auto" }}>
      {/* Paragraphe d'analyse IA */}
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "18px 20px",
          marginBottom: 24,
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--text)",
        }}
      >
        <div style={{ fontSize: 12, color: "var(--line)", marginBottom: 8, fontWeight: 600 }}>ANALYSE</div>
        {analysis}
      </div>

      {/* Sélecteur de période — partagé par les 4 graphiques */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, justifyContent: "center" }}>
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
              border: `1px solid ${period === p ? "var(--line)" : "var(--border)"}`,
              background: period === p ? "rgba(34,211,238,0.12)" : "transparent",
              color: period === p ? "var(--line)" : "var(--muted)",
            }}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <ChartPanel title="Progression totale des quêtes">
        <LineChart labels={series.labels} series={[{ name: "Quêtes complétées", values: series.totalQuests, color: "var(--line)" }]} />
      </ChartPanel>

      <ChartPanel title="Marketing vs Technique">
        <LineChart
          labels={series.labels}
          series={[
            { name: "Marketing", values: series.marketingQuests, color: "var(--line2)" },
            { name: "Technique", values: series.techniqueQuests, color: "var(--line)" },
          ]}
        />
      </ChartPanel>

      <ChartPanel title="Audience (abonnés / visiteurs déclarés)">
        <LineChart labels={series.labels} series={[{ name: "Audience", values: series.audience, color: "var(--success)" }]} />
      </ChartPanel>

      <ChartPanel title="Revenu déclaré (€)">
        <LineChart labels={series.labels} series={[{ name: "Revenu", values: series.revenue, color: "var(--line2)" }]} suffix="€" />
      </ChartPanel>

      <CheckInForm ideaId={ideaId} />
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 16px 8px",
        marginBottom: 18,
      }}
    >
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

// Graphique en ligne, en SVG pur (pas de lib externe) — jusqu'à 2 séries superposées.
function LineChart({
  labels,
  series,
  suffix = "",
}: {
  labels: string[];
  series: { name: string; values: number[]; color: string }[];
  suffix?: string;
}) {
  const width = 640;
  const height = 160;
  const padLeft = 34;
  const padBottom = 24;
  const padTop = 10;
  const innerW = width - padLeft - 8;
  const innerH = height - padTop - padBottom;

  const allValues = series.flatMap((s) => s.values);
  const max = Math.max(1, ...allValues);
  const n = labels.length;

  function x(i: number): number {
    return padLeft + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  }
  function y(v: number): number {
    return padTop + innerH - (v / max) * innerH;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: "visible" }}>
      {/* Repères horizontaux */}
      {[0, 0.5, 1].map((f) => (
        <line
          key={f}
          x1={padLeft}
          x2={width - 8}
          y1={padTop + innerH * (1 - f)}
          y2={padTop + innerH * (1 - f)}
          stroke="var(--border)"
          strokeWidth={1}
        />
      ))}
      {[0, 0.5, 1].map((f) => (
        <text key={f} x={0} y={padTop + innerH * (1 - f) + 4} fontSize={9} fill="var(--muted)">
          {Math.round(max * f)}
          {suffix}
        </text>
      ))}

      {series.map((s) => {
        const points = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
        return (
          <g key={s.name}>
            <polyline points={points} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={s.color} />
            ))}
          </g>
        );
      })}

      {/* Labels d'axe X : premier, milieu, dernier seulement (pour rester lisible) */}
      {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
        <text key={i} x={x(i)} y={height - 6} fontSize={9} fill="var(--muted)" textAnchor="middle">
          {labels[i]}
        </text>
      ))}

      {series.length > 1 && (
        <g>
          {series.map((s, idx) => (
            <g key={s.name}>
              <circle cx={padLeft + idx * 90} cy={padTop - 2} r={3} fill={s.color} />
              <text x={padLeft + idx * 90 + 8} y={padTop + 2} fontSize={9} fill="var(--muted)">
                {s.name}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

function CheckInForm({ ideaId }: { ideaId: string }) {
  const router = useRouter();
  const [clients, setClients] = useState("");
  const [revenue, setRevenue] = useState("");
  const [audience, setAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/checkins/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideaId,
          clients: Number(clients) || 0,
          revenue: Number(revenue) || 0,
          audience: Number(audience) || 0,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Erreur lors de l'enregistrement.");
        return;
      }
      setClients("");
      setRevenue("");
      setAudience("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "18px 16px",
        marginTop: 8,
      }}
    >
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        Faire un check-in — met à jour les graphiques ci-dessus
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <NumberField label="Clients" value={clients} onChange={setClients} />
        <NumberField label="Revenu (€)" value={revenue} onChange={setRevenue} />
        <NumberField label="Audience" value={audience} onChange={setAudience} />
      </div>
      {error && <div style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>{error}</div>}
      <button className="btn-primary" onClick={submit} disabled={loading} style={{ width: "100%" }}>
        {loading ? "Enregistrement…" : "Enregistrer le check-in"}
      </button>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ flex: "1 1 100px" }}>
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--bg)",
          color: "var(--text)",
          fontSize: 14,
        }}
      />
    </div>
  );
}
