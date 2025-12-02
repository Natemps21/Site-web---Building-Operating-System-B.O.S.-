import React, { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar
} from "recharts";
import { format, isValid } from "date-fns";
import type { EnergyRow } from "../../hooks/useEnergyData";

interface Props {
  data: EnergyRow[];
  dateRange: { start: string; end: string };
  onDateChange: (range: { start: string; end: string }) => void;
}

type Granularity = "daily" | "detailed";
const COLORS = ["#f1c40f", "#e67e22", "#e74c3c", "#9b59b6"]; // Jaune, Orange, Rouge, Violet

const SmartEnergyChart: React.FC<Props> = ({ data, dateRange, onDateChange }) => {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [samplingLimit, setSamplingLimit] = useState<number>(200);
  const [startAtZero, setStartAtZero] = useState(true);
  
  // Sélection multiple (Alias ou "Autres")
  const [selectedAliases, setSelectedAliases] = useState<string[]>([]); 

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

  // --- LISTE DES SALLES (Alias) ---
  const availableAliases = useMemo(() => {
    const set = new Set<string>();
    data.forEach(d => {
      if (d.alias && d.alias.length > 0) set.add(d.alias);
      else set.add("Autres / Zones Communes");
    });
    return Array.from(set).sort();
  }, [data]);

  // --- FILTRAGE DATE & SALLES ---
  const filteredData = useMemo(() => {
    let res = data;
    // 1. Date
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      res = res.filter(d => d.timestamp.getTime() >= s && d.timestamp.getTime() <= e);
    }
    // 2. Salles
    if (selectedAliases.length > 0) {
      res = res.filter(d => {
        const name = (d.alias && d.alias.length > 0) ? d.alias : "Autres / Zones Communes";
        return selectedAliases.includes(name);
      });
    }
    // Tri indispensable pour le calcul de delta
    return res.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [data, dateRange, selectedAliases]);

  // --- CALCUL DES DELTAS (CONSOMMATION) ---
  // C'est ici qu'on transforme les Index (1700, 1705) en Conso (5)
  const consumptionData = useMemo(() => {
    if (filteredData.length === 0) return [];

    // On groupe par capteur pour calculer les deltas capteur par capteur
    const sensorGroups: { [uid: string]: EnergyRow[] } = {};
    filteredData.forEach(d => {
      if (!sensorGroups[d.sensor_uid]) sensorGroups[d.sensor_uid] = [];
      sensorGroups[d.sensor_uid].push(d);
    });

    const deltas: { timestamp: Date, alias: string, value: number }[] = [];

    Object.values(sensorGroups).forEach(rows => {
      // On trie par temps
      rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      for (let i = 1; i < rows.length; i++) {
        const current = rows[i];
        const prev = rows[i-1];
        
        // Calcul du Delta
        let diff = current.energyIndex - prev.energyIndex;
        
        // Protection : Si le compteur est remplacé ou bug (valeur négative), on ignore ou on met 0
        if (diff < 0) diff = 0;
        // Protection : Si pic aberrant (> 1000 d'un coup pour 10min), à voir, ici on garde.

        deltas.push({
          timestamp: current.timestamp,
          alias: (current.alias && current.alias.length > 0) ? current.alias : "Autres / Zones Communes",
          value: diff
        });
      }
    });

    return deltas.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [filteredData]);

  // --- KPI TOTAL (Somme des deltas) ---
  const totalConsumption = useMemo(() => {
    return consumptionData.reduce((acc, cur) => acc + cur.value, 0).toFixed(1);
  }, [consumptionData]);

  // --- PRÉPARATION GRAPHIQUE ---
  const chartData = useMemo(() => {
    if (consumptionData.length === 0) return [];

    // CAS 1 : VUE GLOBALE (Pas de sélection ou Total)
    // On veut voir la consommation totale du bâtiment/étage au cours du temps
    if (selectedAliases.length === 0) {
      const mode = (consumptionData.length < 50) ? "detailed" : granularity;

      // MODE JOUR : Somme des deltas par jour
      if (mode === "daily") {
        const dailyGroups: { [key: string]: { sum: number, date: Date } } = {};
        consumptionData.forEach(d => {
          const key = format(d.timestamp, "yyyy-MM-dd");
          if (!dailyGroups[key]) dailyGroups[key] = { sum: 0, date: d.timestamp };
          dailyGroups[key].sum += d.value;
        });
        return Object.values(dailyGroups).map(g => ({
          timestamp: g.date,
          value: parseFloat(g.sum.toFixed(2))
        })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      }

      // MODE DÉTAIL : Sampling
      const limit = Math.max(20, samplingLimit);
      const step = Math.ceil(consumptionData.length / limit);
      // Pour le détail global, on doit sommer les deltas qui ont le même timestamp (plusieurs salles en même temps)
      // Sinon le graph fait des zigzags
      const timeMap: { [time: number]: number } = {};
      consumptionData.forEach(d => {
        const t = d.timestamp.getTime(); // On pourrait arrondir à 10min près
        if (!timeMap[t]) timeMap[t] = 0;
        timeMap[t] += d.value;
      });
      
      const aggregated = Object.entries(timeMap).map(([t, v]) => ({ timestamp: new Date(parseInt(t)), value: v }))
                                                .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      return aggregated.filter((_, i) => i % step === 0);
    }

    // CAS 2 : COMPARAISON (Plusieurs salles)
    // On pivote : { timestamp: ..., "Salle 101": 5, "Autres": 2 }
    
    // Mode Jour
    if (granularity === "daily") {
      const dailyMap: { [key: string]: any } = {};
      consumptionData.forEach(d => {
        const key = format(d.timestamp, "yyyy-MM-dd");
        if (!dailyMap[key]) dailyMap[key] = { timestamp: d.timestamp };
        if (!dailyMap[key][d.alias]) dailyMap[key][d.alias] = 0;
        
        dailyMap[key][d.alias] += d.value;
      });
      return Object.values(dailyMap).sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    // Mode Détail
    const timeMap: { [time: number]: any } = {};
    consumptionData.forEach(d => {
      const t = d.timestamp.getTime();
      if (!timeMap[t]) timeMap[t] = { timestamp: d.timestamp };
      if (!timeMap[t][d.alias]) timeMap[t][d.alias] = 0;
      timeMap[t][d.alias] += d.value;
    });
    
    let result = Object.values(timeMap).sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime());
    const limit = Math.max(20, samplingLimit);
    if (result.length > limit) {
      const step = Math.ceil(result.length / limit);
      result = result.filter((_, i) => i % step === 0);
    }
    return result;

  }, [consumptionData, granularity, samplingLimit, selectedAliases]);

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

  const toggleAlias = (alias: string) => {
    if (alias === "all") { setSelectedAliases([]); return; }
    if (selectedAliases.includes(alias)) {
      setSelectedAliases(prev => prev.filter(s => s !== alias));
    } else {
      if (selectedAliases.length >= 3) return;
      setSelectedAliases(prev => [...prev, alias]);
    }
  };

  const safeFormat = (d: any, fmt: string) => (d && isValid(d)) ? format(d, fmt) : "";
  const xAxisFmt = (d: any) => granularity === "daily" ? safeFormat(d, "dd/MM") : safeFormat(d, "dd/MM HH:mm");

  // RENDER
  if (!data || data.length === 0) return null;

  return (
    <div style={{ background: "#222531", borderRadius: 16, padding: 24, marginBottom: 32, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 15 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.4rem", color: COLORS[0] }}>Évolution Électricité</h3>
          <div style={{ fontSize: "0.9rem", color: "#8ad6e6", opacity: 0.8, marginTop: 4 }}>
            Consommation Période : {totalConsumption} kWh
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
            
            {/* Selecteur Salle (Alias) */}
            <div style={{ position: "relative", display: "inline-block" }}>
               <select 
                 value="" 
                 onChange={(e) => toggleAlias(e.target.value)}
                 style={{ background: "#171924", color: "#fff", border: "1px solid #444", borderRadius: 6, padding: "4px 8px", minWidth: 150 }}
               >
                 <option value="" disabled>Ajouter une salle...</option>
                 <option value="all">-- Tout cumulé --</option>
                 {availableAliases.map(s => (
                   <option key={s} value={s} disabled={selectedAliases.length >= 3 && !selectedAliases.includes(s)}>
                     {selectedAliases.includes(s) ? "✓ " : ""}{s}
                   </option>
                 ))}
               </select>
               <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
                 {selectedAliases.map((s, idx) => (
                   <span key={s} onClick={() => toggleAlias(s)} style={{ fontSize: "0.75rem", background: COLORS[idx % COLORS.length], padding: "2px 6px", borderRadius: 4, cursor: "pointer", color: "#000", fontWeight: "bold" }}>
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
              <button onClick={() => setGranularity("daily")} style={{ background: granularity === "daily" ? COLORS[0] : "transparent", color: granularity === "daily" ? "#000" : "#888", fontWeight: granularity === "daily" ? "bold" : "normal", border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem" }}>Synthèse</button>
              <button onClick={() => setGranularity("detailed")} style={{ background: granularity === "detailed" ? COLORS[0] : "transparent", color: granularity === "detailed" ? "#000" : "#888", fontWeight: granularity === "detailed" ? "bold" : "normal", border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: "0.85rem" }}>Détail</button>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 350, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          {selectedAliases.length === 0 ? (
            // VUE GLOBALE (BAR CHART pour la Conso c'est souvent mieux, mais Area est joli)
            // Utilisons BarChart pour changer et montrer le cumul journalier clairement
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={xAxisFmt} stroke="#ffffff50" minTickGap={50} />
              <YAxis domain={startAtZero ? [0, 'auto'] : ['auto', 'auto']} stroke="#ffffff50" unit=" kWh" />
              <Tooltip contentStyle={{ backgroundColor: "#171924", border: "1px solid #333", borderRadius: 8 }} labelFormatter={(d) => safeFormat(d, "dd/MM HH:mm")} formatter={(val: number) => [`${val} kWh`, "Conso"]} />
              <Legend />
              <Bar dataKey="value" fill={COLORS[0]} name="Consommation Globale" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            // VUE COMPARAISON (LineChart)
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="timestamp" tickFormatter={xAxisFmt} stroke="#ffffff50" minTickGap={50} />
              <YAxis domain={startAtZero ? [0, 'auto'] : ['auto', 'auto']} stroke="#ffffff50" unit=" kWh" />
              <Tooltip contentStyle={{ backgroundColor: "#171924", border: "1px solid #333", borderRadius: 8 }} labelFormatter={(d) => safeFormat(d, "dd/MM HH:mm")} />
              <Legend />
              {selectedAliases.map((alias, idx) => (
                <Line 
                  key={alias} 
                  type="monotone" 
                  dataKey={alias} 
                  stroke={COLORS[idx % COLORS.length]} 
                  strokeWidth={3} 
                  dot={false} 
                  name={alias}
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

export default SmartEnergyChart;