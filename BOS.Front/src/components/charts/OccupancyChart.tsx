import React, { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from "recharts";
import { format, isValid } from "date-fns";
import type { OccupancyRow } from "../../hooks/useOccupancyData";

interface Props {
  data: OccupancyRow[];
  dateRange: { start: string; end: string };
  onDateChange: (range: { start: string; end: string }) => void;
}

type Granularity = "daily" | "detailed";
const COLORS = ["#2ecc71", "#f1c40f", "#e67e22", "#9b59b6"]; // Vert, Jaune, Orange...

const SmartOccupancyChart: React.FC<Props> = ({ data, dateRange, onDateChange }) => {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [samplingLimit, setSamplingLimit] = useState<number>(200);
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
    const set = new Set(data.map(d => d.alias || "Inconnu"));
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
      res = res.filter(d => selectedSensors.includes(d.alias));
    }
    return res.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [data, dateRange, selectedSensors]);

  // --- KPI (Taux d'occupation moyen sur la période) ---
  const avgOccupancyRate = useMemo(() => {
    if (filteredData.length === 0) return 0;
    const occupiedCount = filteredData.filter(d => d.isOccupied).length;
    return ((occupiedCount / filteredData.length) * 100).toFixed(1);
  }, [filteredData]);

  // --- PRÉPARATION GRAPHIQUE ---
  const chartData = useMemo(() => {
    if (filteredData.length === 0) return [];

    // CAS 1 : VUE GLOBALE (TAUX D'OCCUPATION %)
    if (selectedSensors.length === 0) {
      const mode = (filteredData.length < 50) ? "detailed" : granularity;

      // Mode Jour : Moyenne du taux d'occupation par jour
      if (mode === "daily") {
        const groups: { [key: string]: { occupied: number, total: number, date: Date } } = {};
        filteredData.forEach(r => {
          const key = format(r.timestamp, "yyyy-MM-dd");
          if (!groups[key]) groups[key] = { occupied: 0, total: 0, date: r.timestamp };
          if (r.isOccupied) groups[key].occupied++;
          groups[key].total++;
        });
        return Object.values(groups).map(g => ({
          timestamp: g.date,
          value: parseFloat(((g.occupied / g.total) * 100).toFixed(1))
        })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      }

      // Mode Détail : % d'occupation à l'instant T (sur l'ensemble des capteurs)
      const timeMap: { [time: number]: { occupied: number, total: number } } = {};
      filteredData.forEach(d => {
        // On arrondit à la minute pour grouper les capteurs
        const t = Math.floor(d.timestamp.getTime() / 60000) * 60000; 
        if (!timeMap[t]) timeMap[t] = { occupied: 0, total: 0 };
        if (d.isOccupied) timeMap[t].occupied++;
        timeMap[t].total++;
      });
      
      const aggregated = Object.entries(timeMap).map(([t, v]) => ({
        timestamp: new Date(parseInt(t)),
        value: parseFloat(((v.occupied / v.total) * 100).toFixed(1))
      })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      const limit = Math.max(20, samplingLimit);
      const step = Math.ceil(aggregated.length / limit);
      return aggregated.filter((_, i) => i % step === 0);
    }

    // CAS 2 : VUE INDIVIDUELLE (0 ou 1)
    // On pivote : { timestamp: ..., "Salle 101": 1, "Salle 102": 0 }
    const timeMap: { [time: number]: any } = {};
    filteredData.forEach(d => {
      const t = d.timestamp.getTime();
      if (!timeMap[t]) timeMap[t] = { timestamp: d.timestamp };
      // 1 = Occupé, 0 = Libre
      timeMap[t][d.alias] = d.isOccupied ? 1 : 0;
    });

    let result = Object.values(timeMap).sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // En mode individuel, on évite de trop sampler sinon on rate les changements d'état courts
    // Mais on doit quand même protéger le navigateur
    const limit = Math.max(50, samplingLimit); 
    if (result.length > limit) {
      const step = Math.ceil(result.length / limit);
      result = result.filter((_, i) => i % step === 0);
    }
    return result;

  }, [filteredData, granularity, samplingLimit, selectedSensors]);

  // Handlers
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
    <div style={{ background: "#222531", borderRadius: 16, padding: 24, marginBottom: 32, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 15 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.4rem", color: COLORS[0] }}>Occupation des Salles</h3>
          <div style={{ fontSize: "0.9rem", color: "#8ad6e6", opacity: 0.8, marginTop: 4 }}>
            {selectedSensors.length === 0 ? `Taux d'occupation moyen : ${avgOccupancyRate}%` : "Comparaison d'états (1=Occupé, 0=Libre)"}
          </div>
        </div>
        
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#171924", padding: "6px 12px", borderRadius: 8, border: "1px solid #444" }}>
            <span style={{ fontSize: "0.8rem", color: "#aaa" }}>Du</span>
            <input type="datetime-local" value={dateRange.start} onChange={e => handleDate('start', e.target.value)} style={inputStyle} />
            <span style={{ fontSize: "0.8rem", color: "#aaa" }}>au</span>
            <input type="datetime-local" value={dateRange.end} onChange={e => handleDate('end', e.target.value)} style={inputStyle} />
            <button onClick={handleResetDates} title="Mois entier" style={{ background: "#333", border: "none", color: "#fff", borderRadius: 4, cursor: "pointer", padding: "4px 8px", marginLeft: 6 }}>↺</button>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
            <div style={{ position: "relative", display: "inline-block" }}>
               <select 
                 value="" 
                 onChange={(e) => toggleSensor(e.target.value)}
                 style={{ background: "#171924", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "4px 8px", minWidth: 150 }}
               >
                 <option value="" disabled>Ajouter une salle...</option>
                 <option value="all">-- Vue Globale (%) --</option>
                 {allSensors.map(s => (
                   <option key={s} value={s} disabled={selectedSensors.length >= 3 && !selectedSensors.includes(s)}>
                     {selectedSensors.includes(s) ? "✓ " : ""}{s}
                   </option>
                 ))}
               </select>
               <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
                 {selectedSensors.map((s, idx) => (
                   <span key={s} onClick={() => toggleSensor(s)} style={{ fontSize: "0.75rem", background: COLORS[idx], padding: "2px 6px", borderRadius: 4, cursor: "pointer", color: "#000", fontWeight: "bold" }}>
                     {s} ✕
                   </span>
                 ))}
               </div>
            </div>

            <div style={{ display: "flex", background: "#171924", borderRadius: 6, padding: 2, border: "1px solid #444" }}>
              <button onClick={() => setGranularity("daily")} style={{ background: granularity === "daily" ? COLORS[0] : "transparent", color: granularity === "daily" ? "#000" : "#888", fontWeight: granularity === "daily" ? "bold" : "normal", border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem" }}>Synthèse</button>
              <button onClick={() => setGranularity("detailed")} style={{ background: granularity === "detailed" ? COLORS[0] : "transparent", color: granularity === "detailed" ? "#000" : "#888", fontWeight: granularity === "detailed" ? "bold" : "normal", border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem" }}>Détail</button>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 350, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          {selectedSensors.length === 0 ? (
            // VUE GLOBALE : Area Chart en %
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorOcc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={xAxisFmt} stroke="#ffffff50" minTickGap={50} />
              <YAxis domain={[0, 100]} stroke="#ffffff50" unit="%" />
              <Tooltip contentStyle={{ backgroundColor: "#171924", border: "1px solid #333", borderRadius: 8 }} labelFormatter={(d) => safeFormat(d, "dd/MM HH:mm")} formatter={(val: number) => [`${val}%`, "Taux d'occupation"]} />
              <Legend />
              <Area type="monotone" dataKey="value" stroke={COLORS[0]} fillOpacity={1} fill="url(#colorOcc)" name="Taux d'Occupation Global" isAnimationActive={false} />
            </AreaChart>
          ) : (
            // VUE INDIVIDUELLE : Step Line (0/1)
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={xAxisFmt} stroke="#ffffff50" minTickGap={50} />
              <YAxis domain={[0, 1]} ticks={[0, 1]} stroke="#ffffff50" tickFormatter={(v) => v === 1 ? "Occupé" : "Libre"} />
              <Tooltip contentStyle={{ backgroundColor: "#171924", border: "1px solid #333", borderRadius: 8 }} labelFormatter={(d) => safeFormat(d, "dd/MM HH:mm")} formatter={(val: number) => [val === 1 ? "Occupé" : "Libre", "État"]} />
              <Legend />
              {selectedSensors.map((sensor, idx) => (
                <Line 
                  key={sensor} 
                  type="stepAfter" // IMPORTANT : Effet "créneau"
                  dataKey={sensor} 
                  stroke={COLORS[idx % COLORS.length]} 
                  strokeWidth={3} 
                  dot={false} 
                  name={sensor}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SmartOccupancyChart;