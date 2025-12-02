import React, { useState, useTransition, useMemo } from "react";
import styles from "./TempDashboard.module.css";
import { useTemperatureData } from "../../../hooks/useTemperatureData";
import TemperatureChart from "../../../components/charts/TemperatureChart"; // Ex-SmartChart
import Chatbot from "../../../components/common/chatbot";
import { useComparison } from "../../../context/ComparisonContext";

// --- CONFIGURATION DES ÉTAGES ---
const FLOORS = [
  { key: "Sous-sol", label: "Sous-sol", image: "/thumbnails/sous-sol.png", file: "temperature_Sous-sol_02_25_clean.csv" },
  { key: "RDC", label: "RDC", image: "/thumbnails/rdc.png", file: "temperature_RDC_02_25_clean.csv" },
  { key: "Etage 1", label: "Etage 1", image: "/thumbnails/etage1.png", file: "temperature_etage_1_02_25_clean.csv" },
  { key: "Etage 2", label: "Etage 2", image: "/thumbnails/etage2.png", file: "temperature_etage_2_02_25_clean.csv" },
  { key: "Etage 3", label: "Etage 3", image: "/thumbnails/etage3.png", file: "temperature_etage_3_02_25_clean.csv" },
  { key: "Etage 4", label: "Etage 4", image: "/thumbnails/etage4.png", file: "temperature_etage_4_02_25_clean.csv" },
  { key: "Etage 5", label: "Etage 5", image: "/thumbnails/etage5.png", file: "temperature_etage_5_02_25_clean.csv" }
];

const TempDashboard: React.FC = () => {
  // 1. Hook de comparaison
  const { addWidget } = useComparison(); 

  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const allKeys = FLOORS.map(f => f.key);
  const { data, loading, loadedCount, totalCount } = useTemperatureData(FLOORS);

  const toggleSelect = (floorKey: string) => {
    startTransition(() => {
      setSelected(prev => prev.includes(floorKey) ? prev.filter(e => e !== floorKey) : [...prev, floorKey]);
    });
  };

  const selectAll = () => {
    startTransition(() => setSelected(allKeys));
  };

  const unselectAll = () => {
    startTransition(() => setSelected([]));
  };

  const globalData = useMemo(() => {
    return selected.flatMap(key => data[key] || []);
  }, [selected, data]);

  const contextSummary = useMemo(() => {
    if (globalData.length === 0) return "Aucune donnée de température chargée ou aucun étage sélectionné.";

    const validData = globalData.filter(d => d.isValidSensor);
    if (validData.length === 0) return "Données chargées mais aucun capteur valide.";

    const count = validData.length;
    const sum = validData.reduce((acc, cur) => acc + cur.temperature, 0);
    const average = (sum / count).toFixed(1);

    const maxRec = validData.reduce((prev, curr) => (prev.temperature > curr.temperature) ? prev : curr, validData[0]);
    const minRec = validData.reduce((prev, curr) => (prev.temperature < curr.temperature) ? prev : curr, validData[0]);

    const dailyStats: { [date: string]: { sum: number, count: number } } = {};
    validData.forEach(d => {
      const dayKey = d.timestamp.toLocaleDateString("fr-FR");
      if (!dailyStats[dayKey]) dailyStats[dayKey] = { sum: 0, count: 0 };
      dailyStats[dayKey].sum += d.temperature;
      dailyStats[dayKey].count += 1;
    });

    const dailyDetailsString = Object.entries(dailyStats)
      .slice(0, 50)
      .map(([day, stats]) => `- ${day} : ${(stats.sum / stats.count).toFixed(1)}°C`)
      .join("\n");

    const floorsList = selected.join(", ");

    return `
      CONTEXTE DU DASHBOARD TEMPÉRATURE :
      1. PÉRIMÈTRE : Etages ${floorsList}. ${count} points.
      2. STATS : Moyenne ${average}°C. Max ${maxRec.temperature}°C. Min ${minRec.temperature}°C.
      3. DÉTAIL QUOTIDIEN (Moyenne par jour) :
      ${dailyDetailsString}
      4. CONSIGNE : Pas de gras (**).
    `;
  }, [globalData, selected]);

  return (
    <div className={styles.mainContainer}>
      
      <div className={styles.iconBar}>
        <button
          className={`${styles.floorBtn} ${selected.length === allKeys.length ? styles.selected : ""}`}
          onClick={selected.length === allKeys.length ? unselectAll : selectAll}
        >
          <span className={styles.iconFullBldg} />
          Bâtiment entier
        </button>
        {FLOORS.map(floor => (
          <button
            key={floor.key}
            className={`${styles.floorBtn} ${selected.includes(floor.key) ? styles.selected : ""}`}
            onClick={() => toggleSelect(floor.key)}
          >
            <img src={floor.image} alt={floor.label} className={styles.floorIcon} />
            {floor.label}
          </button>
        ))}
      </div>

      <div className={styles.dashboard} style={{ opacity: isPending ? 0.7 : 1, transition: "opacity 0.2s" }}>
        
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "#8ad6e6", fontSize: "1.2rem" }}>
            Chargement des données... ({loadedCount} / 12 fichiers)
          </div>
        )}

        {!loading && selected.length === 0 && (
          <div className={styles.empty}>
            Sélectionne un ou plusieurs étages pour afficher le dashboard
          </div>
        )}

        {!loading && selected.length > 0 && (
          <>
            {/* GRAPHIQUE GLOBAL */}
            {selected.length > 1 && (
              <div style={{ marginBottom: 50, position: "relative" }}>
                <h2 style={{ color: "#fff", borderLeft: "4px solid #58eeff", paddingLeft: 16, marginBottom: 24 }}>
                  Vue d'ensemble ({selected.length} étages)
                </h2>
                <TemperatureChart 
                  title="Température Moyenne Globale" 
                  data={globalData} 
                  color="#58eeff" 
                />
                
                {/* BOUTON ÉPINGLER GLOBAL */}
                <button
                  onClick={() => addWidget({ type: "temp", title: "Température Globale", data: globalData })}
                  style={{
                    position: "absolute", bottom: 20, left: 30, zIndex: 10,
                    background: "#222531", border: "1px solid #58eeff", color: "#58eeff",
                    borderRadius: "50%", width: 40, height: 40, cursor: "pointer",
                    fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
                  }}
                  title="Épingler ce graphique"
                >
                  📌
                </button>
              </div>
            )}

            {/* GRAPHIQUES PAR ÉTAGE */}
            <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
              {selected.map(floorKey => {
                const floorRows = data[floorKey];
                if (!floorRows || floorRows.length === 0) return null;

                return (
                  <div key={floorKey} style={{ position: "relative" }}>
                    <TemperatureChart 
                      title={`Détail : ${floorKey}`}
                      data={floorRows}
                      color="#a29bfe"
                    />

                    {/* BOUTON ÉPINGLER ÉTAGE */}
                    <button
                      onClick={() => addWidget({ type: "temp", title: `Température ${floorKey}`, data: floorRows })}
                      style={{
                        position: "absolute", bottom: 50, left: 30, zIndex: 10,
                        background: "#222531", border: "1px solid #a29bfe", color: "#a29bfe",
                        borderRadius: "50%", width: 40, height: 40, cursor: "pointer",
                        fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
                      }}
                      title="Épingler ce graphique"
                    > 
                      📌
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Chatbot contextData={contextSummary} />

    </div>
  );
};

export default TempDashboard;