import React, { useState, useCallback, useMemo } from "react";
import { useWaterData, type WaterRow } from "../../../hooks/useWaterData";
// --- NOUVEAUX IMPORTS ---
import WaterChart from "../../../components/charts/WaterChart";       // Ex-SmartWaterChart
import WaterTable from "../../../components/tables/WaterTable";       // Ex-WaterDataTable
import Chatbot from "../../../components/common/chatbot";             // Ex-Chatbot
// 1. IMPORT DU CONTEXTE
import { useComparison } from "../../../context/ComparisonContext";

const Eau: React.FC = () => {
  // 2. LE HOOK DOIT ÊTRE ICI (DANS LA FONCTION)
  const { addWidget } = useComparison();

  // 1. Chargement des données
  const FILE_NAME = "water_02_25_clean.csv";
  const { data, loading } = useWaterData(FILE_NAME);

  // 2. ETAT PARTAGÉ : La plage de date
  const [globalDateRange, setGlobalDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });

  // 3. Fonction pour mettre à jour la date
  const handleDateChange = useCallback((range: { start: string; end: string }) => {
    setGlobalDateRange(range);
  }, []);

  // 4. PRÉPARATION DU CONTEXTE POUR L'IA
  const contextSummary = useMemo(() => {
    if (!data || data.length === 0) return "Aucune donnée chargée.";

    let activeData = data;
    if (globalDateRange.start && globalDateRange.end) {
      const s = new Date(globalDateRange.start).getTime();
      const e = new Date(globalDateRange.end).getTime();
      activeData = data.filter(d => d.timestamp.getTime() >= s && d.timestamp.getTime() <= e);
    }

    if (activeData.length === 0) return "Période vide.";

    // Calcul des Deltas pour l'IA
    const sensorGroups: { [name: string]: WaterRow[] } = {};
    activeData.forEach(d => {
      if (!sensorGroups[d.display_name]) sensorGroups[d.display_name] = [];
      sensorGroups[d.display_name].push(d);
    });

    let totalVolume = 0;
    const dailyTotals: { [date: string]: number } = {};

    Object.values(sensorGroups).forEach(rows => {
      rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      for (let i = 1; i < rows.length; i++) {
        const diff = rows[i].value - rows[i-1].value;
        if (diff >= 0) {
          totalVolume += diff;
          const dayKey = rows[i].timestamp.toLocaleDateString("fr-FR");
          if (!dailyTotals[dayKey]) dailyTotals[dayKey] = 0;
          dailyTotals[dayKey] += diff;
        }
      }
    });

    const dailyDetailsString = Object.entries(dailyTotals)
      .slice(0, 50)
      .map(([day, val]) => `- ${day} : ${val.toFixed(0)} Litres`)
      .join("\n");

    const start = globalDateRange.start ? globalDateRange.start.replace("T", " ") : "Début";
    const end = globalDateRange.end ? globalDateRange.end.replace("T", " ") : "Fin";
    const count = activeData.length;

    return `
      CONTEXTE DU DASHBOARD EAU :
      1. PÉRIMÈTRE : Période du ${start} au ${end}. ${count} relevés.
      2. CHIFFRES CLÉS : Consommation TOTALE : ${totalVolume.toFixed(0)} Litres.
      3. DÉTAIL QUOTIDIEN :
      ${dailyDetailsString}
      4. CONSIGNE : Pas de gras (**).
    `;
  }, [data, globalDateRange]);

  return (
    <div style={{ 
      minHeight: "85vh", 
      background: "linear-gradient(to bottom, #2d3146 0%, #171924 100%)",
      padding: "32px 40px",
      color: "#fff"
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        
        <div style={{ marginBottom: 30, borderLeft: "5px solid #00a8ff", paddingLeft: 20 }}>
          <h1 style={{ margin: 0, fontSize: "2rem" }}>Dashboard Eau</h1>
          <p style={{ margin: "5px 0 0 0", opacity: 0.7 }}>Suivi de la consommation du bâtiment</p>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 60, color: "#8ad6e6" }}>
            Chargement des données...
          </div>
        )}

        {!loading && data.length > 0 && (
          <>
            <div style={{ position: "relative" }}>
                <WaterChart 
                data={data} 
                dateRange={globalDateRange} 
                onDateChange={handleDateChange} 
                />
                
                {/* 3. BOUTON ÉPINGLER (COMPARATEUR) */}
                <button
                    onClick={() => addWidget({ type: "water", title: "Eau Globale", data: data })}
                    style={{
                        position: "absolute", bottom: 0, left: 10, zIndex: 10,
                        background: "#222531", border: "1px solid #00a8ff", color: "#00a8ff",
                        borderRadius: "50%", width: 40, height: 40, cursor: "pointer",
                        fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
                    }}
                    title="Épingler ce graphique"
                >
                    📌
                </button>
            </div>

            <WaterTable 
              data={data} 
              dateRange={globalDateRange} 
            />
          </>
        )}
      </div>

      <Chatbot contextData={contextSummary} />
      
    </div>
  );
};

export default Eau;