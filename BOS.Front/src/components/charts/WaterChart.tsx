import React, { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area, BarChart, Bar
} from "recharts";
import { format, isValid } from "date-fns";
import type { WaterRow } from "../../hooks/useWaterData";
// 1. IMPORT DU CONTEXTE
import { useComparison } from "../../context/ComparisonContext";

interface Props {
  data: WaterRow[];
  dateRange: { start: string; end: string };
  onDateChange: (range: { start: string; end: string }) => void;
}

type Granularity = "daily" | "detailed";
const COLORS = ["#00a8ff", "#e056fd", "#00d2d3"]; // Bleu, Violet, Teal

const SmartWaterChart: React.FC<Props> = ({ data, dateRange, onDateChange }) => {
  // 2. RECUPERATION DU HOOK DE COMPARAISON
  const { addWidget } = useComparison();

  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [samplingLimit, setSamplingLimit] = useState<number>(200);
  const [startAtZero, setStartAtZero] = useState(true);
  const [selectedSensors, setSelectedSensors] = useState<string[]>([]);

  const inputStyle: React.CSSProperties = {
    background: "transparent", border: "none", color: "#fff", fontSize: "0.85rem", fontFamily: "inherit", colorScheme: "dark", cursor: "pointer"
  };

  // --- INIT ---
  useEffect(() => {
    if (data.length > 0 && (!dateRange.start || !dateRange.end)) {
      const sorted = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const min = sorted[0].timestamp;
      const max = sorted[sorted.length - 1].timestamp;
      onDateChange({ 
        start: format(min, "yyyy-MM-dd'T'HH:mm"), 
        end: format(max, "yyyy-MM-dd'T'HH:mm") 
      });
      applySmartDefaults(min, max);
    }
  }, [data]);

  const applySmartDefaults = (start: Date, end: Date) => {
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (diffHours > 24 * 7) {
      setGranularity("daily");
      setSamplingLimit(100);
    } else {
      setGranularity("detailed");
      setSamplingLimit(300);
    }
  };

  const allSensors = useMemo(() => {
    const set = new Set(data.map(d => d.display_name || "Inconnu"));
    return Array.from(set).sort();
  }, [data]);

  // --- FILTRAGE ---
  const filteredData = useMemo(() => {
    let res = data;
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      res = res.filter(d => d.timestamp.getTime() >= s && d.timestamp.getTime() <= e);
    }
    if (selectedSensors.length > 0) {
      res = res.filter(d => selectedSensors.includes(d.display_name));
    }
    return res.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [data, dateRange, selectedSensors]);

  // ==================================================================================
  // 1. LOGIQUE INDEX (Volume Total / Compteur) - Graphique du Haut
  // ==================================================================================

  // KPI Total
  const totalIndex = useMemo(() => {
    if (filteredData.length === 0) return 0;
    const lastValueBySensor: { [key: string]: number } = {};
    filteredData.forEach(d => { lastValueBySensor[d.display_name] = d.value; });
    const sum = Object.values(lastValueBySensor).reduce((acc, val) => acc + val, 0);
    return sum.toFixed(0);
  }, [filteredData]);

  // Données Graphique Index
  const chartDataIndex = useMemo(() => {
    if (filteredData.length === 0) return [];

    // Vue Globale
    if (selectedSensors.length === 0) {
      const mode = (filteredData.length < 50) ? "detailed" : granularity;
      
      if (mode === "daily") {
        // --- CORRECTION TYPESCRIPT ICI ---
        // On dit explicitement : "timestamp" est une Date, et les autres clés (string) sont des nombres ou des dates
        const dailyLastValues: { [dateKey: string]: { timestamp: Date; [sensor: string]: number | Date } } = {};
        
        filteredData.forEach(r => {
          const key = format(r.timestamp, "yyyy-MM-dd");
          if (!dailyLastValues[key]) dailyLastValues[key] = { timestamp: r.timestamp };
          
          // r.value est un nombre, c'est valide selon la définition ci-dessus
          dailyLastValues[key][r.display_name] = r.value;
        });
        
        return Object.values(dailyLastValues).map(dayObj => {
          let daySum = 0;
          Object.entries(dayObj).forEach(([k, v]) => { 
            if (k !== "timestamp") daySum += (v as number); 
          });
          return { timestamp: dayObj.timestamp as Date, value: parseFloat(daySum.toFixed(2)) };
        }).sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime());
      }
      
      const limit = Math.max(20, samplingLimit);
      const step = Math.ceil(filteredData.length / limit);
      return filteredData.filter((_, i) => i % step === 0);
    }

    // Vue Comparaison
    const groupedByTime: { [time: number]: any } = {};
    filteredData.forEach(r => {
      const t = r.timestamp.getTime(); 
      if (!groupedByTime[t]) groupedByTime[t] = { timestamp: r.timestamp };
      groupedByTime[t][r.display_name] = r.value;
    });
    let result = Object.values(groupedByTime).sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const limit = Math.max(20, samplingLimit);
    if (result.length > limit) {
      const step = Math.ceil(result.length / limit);
      result = result.filter((_, i) => i % step === 0);
    }
    return result;
  }, [filteredData, granularity, samplingLimit, selectedSensors]);


  // ==================================================================================
  // 2. LOGIQUE DELTA (Consommation) - Graphique du Bas
  // ==================================================================================

  const deltaDataRaw = useMemo(() => {
    if (filteredData.length === 0) return [];
    
    const sensorGroups: { [uid: string]: WaterRow[] } = {};
    filteredData.forEach(d => {
      if (!sensorGroups[d.display_name]) sensorGroups[d.display_name] = [];
      sensorGroups[d.display_name].push(d);
    });

    const deltas: { timestamp: Date, display_name: string, value: number }[] = [];

    Object.values(sensorGroups).forEach(rows => {
      rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      for (let i = 1; i < rows.length; i++) {
        let diff = rows[i].value - rows[i-1].value;
        if (diff < 0) diff = 0;
        deltas.push({
          timestamp: rows[i].timestamp,
          display_name: rows[i].display_name,
          value: diff
        });
      }
    });
    return deltas.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [filteredData]);

  const totalConsumption = useMemo(() => {
    return deltaDataRaw.reduce((acc, cur) => acc + cur.value, 0).toFixed(0);
  }, [deltaDataRaw]);

  const chartDataDelta = useMemo(() => {
    if (deltaDataRaw.length === 0) return [];

    if (selectedSensors.length === 0) {
      const mode = (deltaDataRaw.length < 50) ? "detailed" : granularity;

      if (mode === "daily") {
        const groups: { [key: string]: { sum: number, date: Date } } = {};
        deltaDataRaw.forEach(r => {
          const key = format(r.timestamp, "yyyy-MM-dd");
          if (!groups[key]) groups[key] = { sum: 0, date: r.timestamp };
          groups[key].sum += r.value;
        });
        return Object.values(groups).map(g => ({ timestamp: g.date, value: parseFloat(g.sum.toFixed(2)) }))
                     .sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime());
      }

      const timeMap: { [time: number]: number } = {};
      deltaDataRaw.forEach(d => {
        const t = d.timestamp.getTime();
        if (!timeMap[t]) timeMap[t] = 0;
        timeMap[t] += d.value;
      });
      const aggregated = Object.entries(timeMap).map(([t, v]) => ({ timestamp: new Date(parseInt(t)), value: v }))
                                                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const limit = Math.max(20, samplingLimit);
      const step = Math.ceil(aggregated.length / limit);
      return aggregated.filter((_, i) => i % step === 0);
    }

    const timeMap: { [time: number]: any } = {};
    deltaDataRaw.forEach(d => {
      const t = d.timestamp.getTime();
      if (!timeMap[t]) timeMap[t] = { timestamp: d.timestamp };
      if (!timeMap[t][d.display_name]) timeMap[t][d.display_name] = 0;
      timeMap[t][d.display_name] += d.value;
    });
    let result = Object.values(timeMap).sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const limit = Math.max(20, samplingLimit);
    if (result.length > limit) {
      const step = Math.ceil(result.length / limit);
      result = result.filter((_, i) => i % step === 0);
    }
    return result;

  }, [deltaDataRaw, granularity, samplingLimit, selectedSensors]);


  // ==================================================================================
  // HANDLERS & UTILS
  // ==================================================================================

  const handleDate = (type: 'start' | 'end', val: string) => {
    const newRange = { ...dateRange, [type]: val };
    onDateChange(newRange);
    if (newRange.start && newRange.end) {
      const s = new Date(newRange.start);
      const e = new Date(newRange.end);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) applySmartDefaults(s, e);
    }
  };

  const handleResetDates = () => {
    if (data.length > 0) {
      const sorted = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const min = sorted[0].timestamp;
      const max = sorted[sorted.length - 1].timestamp;
      onDateChange({ start: format(min, "yyyy-MM-dd'T'HH:mm"), end: format(max, "yyyy-MM-dd'T'HH:mm") });
      applySmartDefaults(min, max);
    }
  };

  const toggleSensor = (sensor: string) => {
    if (sensor === "all") { setSelectedSensors([]); return; }
    if (selectedSensors.includes(sensor)) {
      setSelectedSensors(prev => prev.filter(s => s !== sensor));
    } else {
      if (selectedSensors.length >= 3) return;
      setSelectedSensors(prev => [...prev, sensor]);
    }
  };

  const safeFormat = (d: any, fmt: string) => (d && isValid(d)) ? format(d, fmt) : "";
  const xAxisFmt = (d: any) => granularity === "daily" ? safeFormat(d, "dd/MM") : safeFormat(d, "dd/MM HH:mm");

  return (
    <div style={{ background: "#222531", borderRadius: 16, padding: 24, marginBottom: 32, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", position: "relative" }}>
      
      {/* --- HEADER GLOBAL --- */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 15 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.4rem", color: COLORS[0] }}>Analyse Eau</h3>
          <div style={{ fontSize: "0.9rem", color: "#8ad6e6", opacity: 0.8, marginTop: 4 }}>
            Index Fin : <b>{totalIndex} L</b> &bull; Consommation Période : <b>{totalConsumption} L</b>
          </div>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          {/* Dates */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#171924", padding: "6px 12px", borderRadius: 8, border: "1px solid #444" }}>
            <span style={{ fontSize: "0.8rem", color: "#aaa" }}>Du</span>
            <input type="datetime-local" value={dateRange.start} onChange={e => handleDate('start', e.target.value)} style={inputStyle} />
            <span style={{ fontSize: "0.8rem", color: "#aaa" }}>au</span>
            <input type="datetime-local" value={dateRange.end} onChange={e => handleDate('end', e.target.value)} style={inputStyle} />
            <button onClick={handleResetDates} title="Mois entier" style={{ background: "#333", border: "none", color: "#fff", borderRadius: 4, cursor: "pointer", padding: "4px 8px", marginLeft: 6 }}>↺</button>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
            
            <div style={{ position: "relative", display: "inline-block" }}>
               <select 
                 value="" 
                 onChange={(e) => toggleSensor(e.target.value)}
                 style={{ background: "#171924", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "4px 8px", minWidth: 150 }}
               >
                 <option value="" disabled>Ajouter un capteur...</option>
                 <option value="all">-- Vue Globale --</option>
                 {allSensors.map(s => (
                   <option key={s} value={s} disabled={selectedSensors.length >= 3 && !selectedSensors.includes(s)}>
                     {selectedSensors.includes(s) ? "✓ " : ""}{s}
                   </option>
                 ))}
               </select>
               <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
                 {selectedSensors.map((s, idx) => (
                   <span key={s} onClick={() => toggleSensor(s)} style={{ fontSize: "0.75rem", background: COLORS[idx], padding: "2px 6px", borderRadius: 4, cursor: "pointer" }}>
                     {s} ✕
                   </span>
                 ))}
               </div>
            </div>

            {granularity === "detailed" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#171924", padding: "4px 12px", borderRadius: 6, border: "1px solid #444" }}>
                <span style={{ fontSize: "0.75rem", color: "#aaa" }}>Lissage:</span>
                <input type="range" min="50" max="500" step="10" value={samplingLimit} onChange={e => setSamplingLimit(Number(e.target.value))} style={{ width: 80, cursor: "pointer" }} />
              </div>
            )}
            
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", cursor: "pointer", background: "#171924", padding: "4px 8px", borderRadius: 6, border: "1px solid #444" }}>
              <input type="checkbox" checked={startAtZero} onChange={(e) => setStartAtZero(e.target.checked)} />
              Axe 0
            </label>

            <div style={{ display: "flex", background: "#171924", borderRadius: 6, padding: 2, border: "1px solid #444" }}>
              <button onClick={() => setGranularity("daily")} style={{ background: granularity === "daily" ? COLORS[0] : "transparent", color: granularity === "daily" ? "#fff" : "#888", border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem" }}>Synthèse</button>
              <button onClick={() => setGranularity("detailed")} style={{ background: granularity === "detailed" ? COLORS[0] : "transparent", color: granularity === "detailed" ? "#fff" : "#888", border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem" }}>Détail</button>
            </div>
          </div>
        </div>
      </div>

      {/* --- GRAPH 1 : INDEX (VOLUME CUMULÉ) --- */}
      <div style={{ height: 250, width: "100%", marginBottom: 10 }}>
        <h4 style={{ margin: "0 0 10px 20px", color: "#aaa", fontSize: "0.9rem", textTransform: "uppercase" }}>1. Évolution Index (Compteur)</h4>
        <ResponsiveContainer width="100%" height="100%">
          {selectedSensors.length === 0 ? (
            <AreaChart data={chartDataIndex}>
              <defs>
                <linearGradient id="colorWaterIndex" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={xAxisFmt} stroke="#ffffff50" minTickGap={50} />
              <YAxis domain={startAtZero ? [0, 'auto'] : ['auto', 'auto']} stroke="#ffffff50" unit=" L" />
              <Tooltip contentStyle={{ backgroundColor: "#171924", border: "1px solid #333", borderRadius: 8 }} labelFormatter={(d) => safeFormat(d, "dd/MM HH:mm")} />
              <Legend />
              <Area type="monotone" dataKey="value" stroke={COLORS[0]} fillOpacity={1} fill="url(#colorWaterIndex)" name="Index (L)" isAnimationActive={false} />
            </AreaChart>
          ) : (
            <LineChart data={chartDataIndex}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={xAxisFmt} stroke="#ffffff50" minTickGap={50} />
              <YAxis domain={startAtZero ? [0, 'auto'] : ['auto', 'auto']} stroke="#ffffff50" unit=" L" />
              <Tooltip contentStyle={{ backgroundColor: "#171924", border: "1px solid #333", borderRadius: 8 }} labelFormatter={(d) => safeFormat(d, "dd/MM HH:mm")} />
              <Legend />
              {selectedSensors.map((s, i) => (
                <Line key={s} type="monotone" dataKey={s} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} name={s} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Séparateur */}
      <hr style={{ border: "none", borderTop: "1px solid #ffffff10", margin: "20px 0" }} />

      {/* --- GRAPH 2 : DELTA (CONSOMMATION) --- */}
      <div style={{ height: 250, width: "100%" }}>
        <h4 style={{ margin: "0 0 10px 20px", color: "#aaa", fontSize: "0.9rem", textTransform: "uppercase" }}>2. Consommation (Delta)</h4>
        <ResponsiveContainer width="100%" height="100%">
          {selectedSensors.length === 0 ? (
            <BarChart data={chartDataDelta}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={xAxisFmt} stroke="#ffffff50" minTickGap={50} />
              <YAxis domain={[0, 'auto']} stroke="#ffffff50" unit=" L" />
              <Tooltip contentStyle={{ backgroundColor: "#171924", border: "1px solid #333", borderRadius: 8 }} labelFormatter={(d) => safeFormat(d, "dd/MM HH:mm")} />
              <Legend />
              <Bar dataKey="value" fill={COLORS[0]} name="Conso (L)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          ) : (
            <LineChart data={chartDataDelta}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={xAxisFmt} stroke="#ffffff50" minTickGap={50} />
              <YAxis domain={[0, 'auto']} stroke="#ffffff50" unit=" L" />
              <Tooltip contentStyle={{ backgroundColor: "#171924", border: "1px solid #333", borderRadius: 8 }} labelFormatter={(d) => safeFormat(d, "dd/MM HH:mm")} />
              <Legend />
              {selectedSensors.map((s, i) => (
                <Line key={s} type="monotone" dataKey={s} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} name={s + " (Delta)"} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      

    </div>
  );
};

export default SmartWaterChart;