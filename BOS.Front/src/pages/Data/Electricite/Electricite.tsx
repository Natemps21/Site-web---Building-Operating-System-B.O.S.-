import React, { useState, useCallback, useMemo } from "react";
import styles from "../Temperature/TempDashboard.module.css";
// CORRECTION ICI : Ajout de "type" devant EnergyRow
import { useEnergyData, type EnergyRow } from "../../../hooks/useEnergyData";
import EnergyChart from "../../../components/charts/EnergyChart";     // Ex-SmartEnergyChart
import EnergyTable from "../../../components/tables/EnergyTable";     // Ex-EnergyDataTable
import Chatbot from "../../../components/common/chatbot";   
import { useComparison } from "../../../context/ComparisonContext";

const FLOORS = [
  { key: "Sous-sol", label: "Sous-sol", image: "/thumbnails/sous-sol.png" },
  { key: "RDC", label: "RDC", image: "/thumbnails/rdc.png" },
  { key: "Etage 1", label: "Etage 1", image: "/thumbnails/etage1.png" },
  { key: "Etage 2", label: "Etage 2", image: "/thumbnails/etage2.png" },
  { key: "Etage 3", label: "Etage 3", image: "/thumbnails/etage3.png" },
  { key: "Etage 4", label: "Etage 4", image: "/thumbnails/etage4.png" },
  { key: "Etage 5", label: "Etage 5", image: "/thumbnails/etage5.png" }
];

const Electricite: React.FC = () => {
  // 1. LE HOOK DOIT ÊTRE ICI (DANS LA FONCTION)
  const { addWidget } = useComparison();

  const FILE_NAME = "energy_Power Outlets_02_25_clean.csv";
  const { data, loading } = useEnergyData(FILE_NAME);

  const [selectedFloors, setSelectedFloors] = useState<string[]>([]);
  const allKeys = FLOORS.map(f => f.key);

  const toggleSelect = (key: string) => {
    setSelectedFloors(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };
  const selectAll = () => setSelectedFloors(allKeys);
  const unselectAll = () => setSelectedFloors([]);

  const [globalDateRange, setGlobalDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const handleDateChange = useCallback((range: { start: string; end: string }) => setGlobalDateRange(range), []);

  // --- FONCTION DE NETTOYAGE DE TEXTE ---
  const normalize = (str: string | undefined) => {
    if (!str) return "";
    return str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
  };

  // --- FILTRAGE PAR ÉTAGE ---
  const floorFilteredData = useMemo(() => {
    if (selectedFloors.length === 0) return [];
    return data.filter(d => {
      const csvFloor = normalize(d.floor);
      return selectedFloors.some(sel => normalize(sel) === csvFloor);
    });
  }, [data, selectedFloors]);

  // Pour le débogage visuel
  const availableFloorsInCsv = useMemo(() => {
    return Array.from(new Set(data.map(d => d.floor))).sort();
  }, [data]);

  // --- CONTEXTE INTELLIGENT POUR L'IA ---
  const contextSummary = useMemo(() => {
    if (!floorFilteredData || floorFilteredData.length === 0) return "Aucune donnée ou aucun étage sélectionné.";

    // 1. Filtrage Date
    let activeData = floorFilteredData;
    if (globalDateRange.start && globalDateRange.end) {
      const s = new Date(globalDateRange.start).getTime();
      const e = new Date(globalDateRange.end).getTime();
      activeData = floorFilteredData.filter(d => d.timestamp.getTime() >= s && d.timestamp.getTime() <= e);
    }

    if (activeData.length === 0) return "Période sélectionnée vide.";

    // 2. CALCUL DES DELTAS & REGROUPEMENT PAR JOUR
    const sensorGroups: { [uid: string]: EnergyRow[] } = {};
    activeData.forEach(d => {
      if (!sensorGroups[d.sensor_uid]) sensorGroups[d.sensor_uid] = [];
      sensorGroups[d.sensor_uid].push(d);
    });

    let totalKwh = 0;
    let maxConso = 0;
    let maxConsoDate = "";
    
    // NOUVEAU : On stocke la somme par jour ici
    const dailyTotals: { [date: string]: number } = {};

    Object.values(sensorGroups).forEach(rows => {
      // Tri chrono
      rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      // Somme des différences (Deltas)
      for (let i = 1; i < rows.length; i++) {
        let diff = rows[i].energyIndex - rows[i-1].energyIndex;
        
        if (diff >= 0) {
          totalKwh += diff;
          
          // NOUVEAU : Ajout au total du jour concerné
          const dayKey = rows[i].timestamp.toLocaleDateString("fr-FR"); // ex: "10/02/2025"
          if (!dailyTotals[dayKey]) dailyTotals[dayKey] = 0;
          dailyTotals[dayKey] += diff;

          // Pic instantané
          if (diff > maxConso) {
            maxConso = diff;
            maxConsoDate = rows[i].timestamp.toLocaleString();
          }
        }
      }
    });

    // NOUVEAU : Création de la liste textuelle des jours pour l'IA
    const dailyDetailsString = Object.entries(dailyTotals)
      .slice(0, 50) 
      .map(([day, val]) => `- ${day} : ${val.toFixed(1)} kWh`)
      .join("\n");

    const start = globalDateRange.start ? globalDateRange.start.replace("T", " ") : "Début";
    const end = globalDateRange.end ? globalDateRange.end.replace("T", " ") : "Fin";
    const floorsList = selectedFloors.join(", ");

    return `
      CONTEXTE DU DASHBOARD ÉLECTRICITÉ :
      
      1. PÉRIMÈTRE :
      - Étages : ${floorsList}.
      - Période : du ${start} au ${end}.
      
      2. CHIFFRES CLÉS :
      - Consommation TOTALE sur la période : ${totalKwh.toFixed(1)} kWh.
      - Pic instantané : ${maxConso.toFixed(2)} kWh (le ${maxConsoDate}).

      3. DÉTAIL QUOTIDIEN (Consommation par jour) :
      ${dailyDetailsString}

      4. CONSIGNE :
      - Si on te demande la consommation d'un jour précis, cherche dans la liste "DÉTAIL QUOTIDIEN".
      - Si le jour n'est pas dans la liste, dis que tu n'as pas l'info.
      - Ne mets JAMAIS de texte en gras (**) ni (*). Fais des phrases simples.
    `;
  }, [floorFilteredData, globalDateRange, selectedFloors]);


  return (
    <div style={{ minHeight: "85vh", background: "linear-gradient(to bottom, #2d3146 0%, #171924 100%)", padding: "32px 40px", color: "#fff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        
        {/* Boutons Etages */}
        <div className={styles.iconBar}>
          <button className={`${styles.floorBtn} ${selectedFloors.length === allKeys.length ? styles.selected : ""}`} onClick={selectedFloors.length === allKeys.length ? unselectAll : selectAll}>
            <span className={styles.iconFullBldg} />
            Bâtiment entier
          </button>
          {FLOORS.map(floor => (
            <button key={floor.key} className={`${styles.floorBtn} ${selectedFloors.includes(floor.key) ? styles.selected : ""}`} onClick={() => toggleSelect(floor.key)}>
              <img src={floor.image} alt={floor.label} className={styles.floorIcon} />
              {floor.label}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign: "center", padding: 60, color: "#f1c40f" }}>Chargement Électricité...</div>}

        {!loading && selectedFloors.length === 0 && (
          <div className={styles.empty}>Sélectionnez un ou plusieurs étages pour voir la consommation électrique.</div>
        )}

        {/* DEBUG : Si la sélection ne donne rien */}
        {!loading && selectedFloors.length > 0 && floorFilteredData.length === 0 && (
          <div style={{ padding: 20, background: "#e74c3c33", border: "1px solid #e74c3c", borderRadius: 8, marginTop: 20 }}>
            <h3 style={{ margin: "0 0 10px 0", color: "#e74c3c" }}>⚠️ Pas de correspondance trouvée</h3>
            <p>Le code n'arrive pas à lier le bouton au fichier CSV.</p>
            <div style={{ display: "flex", gap: 40, fontSize: "0.9rem" }}>
              <div>
                <strong>Bouton cliqué (Normalisé) :</strong>
                <ul>{selectedFloors.map(f => <li key={f}>"{f}" &rarr; <code>{normalize(f)}</code></li>)}</ul>
              </div>
              <div>
                <strong>Contenu du CSV (Normalisé) :</strong>
                <ul>
                  {availableFloorsInCsv.slice(0, 10).map(f => <li key={f}>"{f}" &rarr; <code>{normalize(f)}</code></li>)}
                </ul>
              </div>
            </div>
          </div>
        )}

        {!loading && selectedFloors.length > 0 && floorFilteredData.length > 0 && (
          <>
            <div style={{ position: "relative" }}>
              <EnergyChart 
                data={floorFilteredData} 
                dateRange={globalDateRange} 
                onDateChange={handleDateChange} 
              />

              {/* 3. BOUTON ÉPINGLER (COMPARATEUR) */}
              <button
                onClick={() => addWidget({ type: "elec", title: "Élec - " + selectedFloors.join(", "), data: floorFilteredData })}
                style={{
                  position: "absolute", bottom: 10, left: 30, zIndex: 10,
                  background: "#222531", border: "1px solid #f1c40f", color: "#f1c40f",
                  borderRadius: "50%", width: 40, height: 40, cursor: "pointer",
                  fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
                }}
                title="Épingler ce graphique"
              >
                📌
              </button>
            </div>

            <EnergyTable 
              data={floorFilteredData} 
              dateRange={globalDateRange} 
              selectedFloors={selectedFloors}
            />
          </>
        )}
      </div>

      {/* CHATBOT */}
      <Chatbot contextData={contextSummary} />

    </div>
  );
};

export default Electricite;