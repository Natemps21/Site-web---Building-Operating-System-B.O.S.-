import React, { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { format, isValid } from "date-fns";
import type { TempRow } from "../../hooks/useTemperatureData";
// IMPORT DU CONTEXTE DE COMPARAISON
import { useComparison } from "../../context/ComparisonContext";

interface SmartChartProps {
  title: string;
  data: TempRow[];
  color?: string;
}

type Granularity = "daily" | "detailed";

const SmartChart: React.FC<SmartChartProps> = ({ title, data, color = "#3fa2f7" }) => {
  // --- HOOKS ---
  const { addWidget } = useComparison(); // Pour épingler

  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [selectedAlias, setSelectedAlias] = useState<string>("all");
  const [showInvalidPoints, setShowInvalidPoints] = useState(false);
  const [startAtZero, setStartAtZero] = useState(false);
  const [showFaultyList, setShowFaultyList] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [samplingLimit, setSamplingLimit] = useState<number>(200);

  const dateInputStyle: React.CSSProperties = {
    background: "transparent", border: "none", color: "#fff", fontSize: "0.85rem", fontFamily: "inherit", colorScheme: "dark", cursor: "pointer"
  };

  // --- LOGIQUE AUTO-SCALE ---
  const applySmartDefaults = (start: Date, end: Date) => {
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (diffHours > 24 * 7) {
      setGranularity("daily");
      setSamplingLimit(100); 
    } else if (diffHours > 72) {
      setGranularity("detailed");
      setSamplingLimit(80);
    } else if (diffHours > 24) {
      setGranularity("detailed");
      setSamplingLimit(200);
    } else {
      setGranularity("detailed");
      setSamplingLimit(400);
    }
  };

  // --- INITIALISATION ---
  useEffect(() => {
    if (data && data.length > 0) {
      const sorted = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const minDate = sorted[0].timestamp;
      const maxDate = sorted[sorted.length - 1].timestamp;
      
      setDateRange({
        start: format(minDate, "yyyy-MM-dd'T'HH:mm"),
        end: format(maxDate, "yyyy-MM-dd'T'HH:mm")
      });
      applySmartDefaults(minDate, maxDate);
    }
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div style={{ padding: 20, background: "#222531", borderRadius: 16, marginBottom: 20, color: "#888" }}>
        <h3>{title}</h3>
        <p>Pas de données reçues.</p>
      </div>
    );
  }

  // 1. ALIAS
  const aliases = useMemo(() => {
    const set = new Set(data.map(d => d.alias || "Sans Nom"));
    return Array.from(set).sort();
  }, [data]);

  // 2. FILTRAGE COMPLET
  const fullData = useMemo(() => {
    let filtered = data;
    if (!showInvalidPoints) filtered = filtered.filter(d => d.isValidSensor);
    if (selectedAlias !== "all") filtered = filtered.filter(d => (d.alias || "Sans Nom") === selectedAlias);
    if (dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start).getTime();
      const end = new Date(dateRange.end).getTime();
      filtered = filtered.filter(d => {
        const t = d.timestamp.getTime();
        return t >= start && t <= end;
      });
    }
    return filtered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [data, showInvalidPoints, selectedAlias, dateRange]);

  // 3. CAPTEURS HS
  const faultySensors = useMemo(() => {
    let contextData = data;
    if (dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start).getTime();
      const end = new Date(dateRange.end).getTime();
      contextData = contextData.filter(d => d.timestamp.getTime() >= start && d.timestamp.getTime() <= end);
    }
    if (selectedAlias !== "all") contextData = contextData.filter(d => (d.alias || "Sans Nom") === selectedAlias);

    const faultyMap = new Map<string, { uid: string, alias: string }>();
    contextData.forEach(d => {
      if (!d.isValidSensor) {
        if (!faultyMap.has(d.sensor_uid)) faultyMap.set(d.sensor_uid, { uid: d.sensor_uid, alias: d.alias });
      }
    });
    return Array.from(faultyMap.values());
  }, [data, selectedAlias, dateRange]);

  // 4. MOYENNE
  const avgTemp = useMemo(() => {
    if (fullData.length === 0) return 0;
    const sum = fullData.reduce((acc, cur) => acc + cur.temperature, 0);
    return (sum / fullData.length).toFixed(1);
  }, [fullData]);

  // 5. PRÉPARATION GRAPHIQUE
  const chartData = useMemo(() => {
    if (fullData.length === 0) return [];

    const forceDetail = fullData.length < 50;
    const mode = forceDetail ? "detailed" : granularity;

    if (mode === "daily") {
      const dailyGroups: { [key: string]: { sum: number; count: number; date: Date } } = {};
      fullData.forEach(row => {
        const dayKey = format(row.timestamp, "yyyy-MM-dd");
        if (!dailyGroups[dayKey]) dailyGroups[dayKey] = { sum: 0, count: 0, date: row.timestamp };
        dailyGroups[dayKey].sum += row.temperature;
        dailyGroups[dayKey].count += 1;
      });
      return Object.values(dailyGroups).map(group => ({
        timestamp: group.date,
        temperature: parseFloat((group.sum / group.count).toFixed(2)),
        count: group.count
      })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    const safeLimit = Math.max(20, samplingLimit);
    if (fullData.length <= safeLimit) return fullData;

    const step = Math.ceil(fullData.length / safeLimit);
    return fullData.filter((_, index) => index % step === 0);

  }, [fullData, granularity, samplingLimit]);

  // --- HANDLERS ---
  const handleDateChange = (type: 'start' | 'end', value: string) => {
    const newRange = { ...dateRange, [type]: value };
    setDateRange(newRange);
    if (newRange.start && newRange.end) {
      const s = new Date(newRange.start);
      const e = new Date(newRange.end);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        applySmartDefaults(s, e);
      }
    }
  };

  const handleResetDates = () => {
    if (data && data.length > 0) {
      const sorted = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const min = sorted[0].timestamp;
      const max = sorted[sorted.length - 1].timestamp;
      setDateRange({
        start: format(min, "yyyy-MM-dd'T'HH:mm"),
        end: format(max, "yyyy-MM-dd'T'HH:mm")
      });
      applySmartDefaults(min, max);
    }
  };

  const safeFormat = (date: any, fmt: string) => {
    if (!date || !(date instanceof Date) || !isValid(date)) return "";
    try { return format(date, fmt); } catch (e) { return ""; }
  };

  const xAxisFormatter = (date: any) => {
    if (granularity === "daily") return safeFormat(date, "dd/MM");
    return safeFormat(date, "dd/MM HH:mm");
  };

  return (
    <div style={{
      background: "#222531", borderRadius: 16, padding: 24, marginBottom: 32,
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", position: "relative"
    }}>
      
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 15, alignItems: "flex-start" }}>
        
        <div>
          <h3 style={{ margin: 0, fontSize: "1.4rem", color: color }}>{title}</h3>
          <div style={{ fontSize: "0.9rem", color: "#8ad6e6", opacity: 0.8, marginTop: 4 }}>
            Moy : {avgTemp}°C &bull; {fullData.length} pts
          </div>
        </div>
        
        {/* CONTROLS */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          
          {/* Ligne 1 : DATES */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#171924", padding: "6px 12px", borderRadius: 8, border: "1px solid #444" }}>
            <span style={{ fontSize: "0.8rem", color: "#aaa" }}>Du</span>
            <input type="datetime-local" value={dateRange.start} onChange={(e) => handleDateChange('start', e.target.value)} style={dateInputStyle} />
            <span style={{ fontSize: "0.8rem", color: "#aaa" }}>au</span>
            <input type="datetime-local" value={dateRange.end} onChange={(e) => handleDateChange('end', e.target.value)} style={dateInputStyle} />
            <button onClick={handleResetDates} title="Réinitialiser" style={{ background: "#333", border: "none", color: "#fff", borderRadius: 4, cursor: "pointer", padding: "4px 8px", fontSize: "0.9rem", marginLeft: 6 }}>↺</button>
          </div>

          {/* Ligne 2 : OPTIONS */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
            
            {granularity === "detailed" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#171924", padding: "4px 12px", borderRadius: 6, border: "1px solid #444" }}>
                <span style={{ fontSize: "0.75rem", color: "#aaa" }}>Points:</span>
                <input type="range" min="20" max="500" step="10" value={samplingLimit} onChange={(e) => setSamplingLimit(Number(e.target.value))} style={{ width: 80, cursor: "pointer" }} title={`Afficher ${samplingLimit} points maximum`} />
                <span style={{ fontSize: "0.75rem", color: "#fff", minWidth: 25, textAlign: "right" }}>{samplingLimit}</span>
              </div>
            )}

            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", cursor: "pointer", background: "#171924", padding: "4px 8px", borderRadius: 6, border: "1px solid #444" }}>
              <input type="checkbox" checked={startAtZero} onChange={(e) => setStartAtZero(e.target.checked)} />
              Axe Y à 0
            </label>

            <div style={{ display: "flex", background: "#171924", borderRadius: 6, padding: 2, border: "1px solid #444" }}>
              <button onClick={() => setGranularity("daily")} style={{ background: granularity === "daily" ? color : "transparent", color: granularity === "daily" ? "#fff" : "#888", border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem" }}>Synthèse</button>
              <button onClick={() => setGranularity("detailed")} style={{ background: granularity === "detailed" ? color : "transparent", color: granularity === "detailed" ? "#fff" : "#888", border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem" }}>Précision</button>
            </div>

            <select value={selectedAlias} onChange={(e) => setSelectedAlias(e.target.value)} style={{ background: "#171924", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "4px 8px", maxWidth: 150 }}>
              <option value="all">Toutes les salles</option>
              {aliases.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          {/* Ligne 3 : ERREURS */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowInvalidPoints(!showInvalidPoints)} style={{ background: showInvalidPoints ? "#ff6b6b33" : "transparent", color: showInvalidPoints ? "#ff6b6b" : "#666", border: "1px solid #444", borderRadius: 6, cursor: "pointer", padding: "4px 12px", fontSize: "0.8rem" }}>
              {showInvalidPoints ? "Cacher points rouges" : "Afficher points rouges"}
            </button>

            <div style={{ position: "relative" }}>
              <button onClick={() => setShowFaultyList(!showFaultyList)} style={{ background: faultySensors.length > 0 ? "#ff4757" : "#2ed573", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                {faultySensors.length > 0 ? `⚠️ ${faultySensors.length} HS` : "✅ Aucun défaut"}
                <span>{showFaultyList ? "▲" : "▼"}</span>
              </button>
              {showFaultyList && faultySensors.length > 0 && (
                <div style={{ position: "absolute", top: "110%", right: 0, width: 280, background: "#2f3640", border: "1px solid #ff4757", borderRadius: 8, padding: 10, zIndex: 10, boxShadow: "0 5px 15px rgba(0,0,0,0.5)" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#ff6b81", fontSize: "0.9rem", borderBottom: "1px solid #ffffff20", paddingBottom: 4 }}>Capteurs défectueux ({faultySensors.length})</h4>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, maxHeight: 150, overflowY: "auto" }}>
                    {faultySensors.map((s, idx) => (
                      <li key={idx} style={{ fontSize: "0.85rem", marginBottom: 6, borderBottom: "1px solid #ffffff10", paddingBottom: 4 }}>
                        <div style={{ color: "#fff", fontWeight: "bold" }}>{s.alias || "Sans Nom"}</div>
                        <div style={{ color: "#a4b0be", fontSize: "0.75rem" }}>UID: {s.uid}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CHART */}
      <div style={{ height: 350, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
            <XAxis dataKey="timestamp" tickFormatter={xAxisFormatter} stroke="#ffffff50" minTickGap={50} />
            <YAxis domain={startAtZero ? [0, 'auto'] : ['auto', 'auto']} stroke="#ffffff50" unit="°C" />
            <Tooltip contentStyle={{ backgroundColor: "#171924", border: "1px solid #333", borderRadius: 8 }} labelFormatter={(d) => safeFormat(d, granularity === "daily" ? "dd MMMM yyyy" : "dd/MM - HH:mm")} formatter={(value: number) => [`${value}°C`, "Température"]} />
            <Legend />
            <Line type="monotone" dataKey="temperature" stroke={color} strokeWidth={3} dot={granularity === "daily"} activeDot={{ r: 6 }} name={granularity === "daily" ? "Moyenne Journalière" : "Température"} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      
    </div>
  );
};

export default SmartChart;