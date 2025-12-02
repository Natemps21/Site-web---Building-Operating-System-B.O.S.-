import React, { useState, useCallback, useMemo } from "react";
import styles from "../Temperature/TempDashboard.module.css";
// CORRECTION IMPORT : Ajout de "type" pour TypeScript
import { useOccupancyData, type OccupancyRow } from "../../../hooks/useOccupancyData"; 
import OccupancyChart from "../../../components/charts/OccupancyChart";       // Ex-SmartOccupancyChart
import OccupancySnapshot from "../../../components/features/OccupancySnapshot"; // Ex-OccupancySnapshot
import OccupancyTable from "../../../components/tables/OccupancyTable";       // Ex-OccupancyDataTable
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

const Occupation: React.FC = () => {
  // 1. HOOK COMPARATEUR
  const { addWidget } = useComparison();
  
  const FILE_NAME = "occupancy_02_25_clean.csv";
  const { data, loading } = useOccupancyData(FILE_NAME);

  const [selectedFloors, setSelectedFloors] = useState<string[]>([]);
  const allKeys = FLOORS.map(f => f.key);

  const toggleSelect = (key: string) => {
    setSelectedFloors(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };
  const selectAll = () => setSelectedFloors(allKeys);
  const unselectAll = () => setSelectedFloors([]);

  const [globalDateRange, setGlobalDateRange] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const handleDateChange = useCallback((range: { start: string; end: string }) => setGlobalDateRange(range), []);

  // Normalisation
  const normalize = (str: string | undefined) => str ? str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "") : "";

  // Filtre Etage
  const floorFilteredData = useMemo(() => {
    if (selectedFloors.length === 0) return [];
    return data.filter(d => {
      const csvFloor = normalize(d.floor);
      return selectedFloors.some(sel => normalize(sel) === csvFloor);
    });
  }, [data, selectedFloors]);


  // --- CONTEXTE INTELLIGENT POUR L'IA (OCCUPATION) ---
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

    // 2. STATISTIQUES GLOBALES
    const totalPoints = activeData.length;
    const occupiedPoints = activeData.filter(d => d.isOccupied).length;
    const globalRate = ((occupiedPoints / totalPoints) * 100).toFixed(1);
    
    // Nombre de capteurs uniques et étages
    const uniqueSensors = new Set(activeData.map(d => d.alias)).size;
    const uniqueFloors = new Set(activeData.map(d => d.floor)).size;

    // 3. DÉTAIL PAR SALLE (Alias)
    const roomStats: { [alias: string]: { occupied: number, total: number, floor: string } } = {};
    activeData.forEach(d => {
      if (!roomStats[d.alias]) roomStats[d.alias] = { occupied: 0, total: 0, floor: d.floor };
      roomStats[d.alias].total += 1;
      if (d.isOccupied) roomStats[d.alias].occupied += 1;
    });

    const roomDetailsString = Object.entries(roomStats)
      .map(([alias, stats]) => {
        const rate = ((stats.occupied / stats.total) * 100).toFixed(0);
        return `- Salle "${alias}" (${stats.floor}) : ${rate}% du temps occupée.`;
      })
      .join("\n");

    // 4. DÉTAIL PAR JOUR (Chronologie)
    const dailyStats: { [date: string]: { occupied: number, total: number } } = {};
    activeData.forEach(d => {
      const dayKey = d.timestamp.toLocaleDateString("fr-FR");
      if (!dailyStats[dayKey]) dailyStats[dayKey] = { occupied: 0, total: 0 };
      dailyStats[dayKey].total += 1;
      if (d.isOccupied) dailyStats[dayKey].occupied += 1;
    });

    const dailyDetailsString = Object.entries(dailyStats)
      .slice(0, 40) // Limite pour ne pas saturer
      .map(([day, stats]) => `- ${day} : Taux global ${((stats.occupied / stats.total) * 100).toFixed(1)}%`)
      .join("\n");

    const start = globalDateRange.start ? globalDateRange.start.replace("T", " ") : "Début";
    const end = globalDateRange.end ? globalDateRange.end.replace("T", " ") : "Fin";

    // 5. CONSTRUCTION DU TEXTE
    return `
      CONTEXTE DU DASHBOARD OCCUPATION (PRÉSENCE) :
      
      1. PÉRIMÈTRE D'ANALYSE :
      - Période : du ${start} au ${end}.
      - Étages concernés : ${selectedFloors.join(", ")} (${uniqueFloors} étages détectés).
      - Capteurs analysés : ${uniqueSensors} capteurs (salles).

      2. TAUX DE PRÉSENCE GLOBAL :
      - Taux moyen : ${globalRate}%.
      
      3. MÉTHODE DE CALCUL :
      Le taux est calculé ainsi :
      (Nombre de relevés "Occupé" / Nombre total de relevés sur la période) * 100.
      
      4. DÉTAIL PAR SALLE (Sur toute la période) :
      ${roomDetailsString}

      5. ÉVOLUTION PAR JOUR (Moyenne de toutes les salles) :
      ${dailyDetailsString}

      6. CONSIGNE DE RÉPONSE :
      - Ne mets JAMAIS de gras (**), ni d'italique.
      - Si on demande si une salle précise était occupée, regarde son taux dans la liste "DÉTAIL PAR SALLE". Si > 0%, dis qu'elle a été occupée. Si 0%, dis qu'elle est restée libre.
      - Si on demande une date précise, regarde "ÉVOLUTION PAR JOUR".
      - Sois explicite sur le fait que c'est une moyenne.
    `;
  }, [floorFilteredData, globalDateRange, selectedFloors]);


  return (
    <div style={{ minHeight: "85vh", background: "linear-gradient(to bottom, #2d3146 0%, #171924 100%)", padding: "32px 40px", color: "#fff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        
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

        {loading && <div style={{ textAlign: "center", padding: 60, color: "#2ecc71" }}>Chargement Occupation...</div>}

        {!loading && selectedFloors.length === 0 && (
          <div className={styles.empty}>Sélectionnez un ou plusieurs étages pour voir l'occupation.</div>
        )}

        {!loading && selectedFloors.length > 0 && floorFilteredData.length > 0 && (
          <>
            {/* 1. Graphique Temporel AVEC BOUTON ÉPINGLER */}
            <div style={{ position: "relative" }}>
              <OccupancyChart 
                data={floorFilteredData} 
                dateRange={globalDateRange} 
                onDateChange={handleDateChange} 
              />
              
              {/* BOUTON ÉPINGLER */}
              <button
                onClick={() => addWidget({ type: "occ", title: "Occupation - " + selectedFloors.join(", "), data: floorFilteredData })}
                style={{
                  position: "absolute", bottom: 10, left: 30, zIndex: 10,
                  background: "#222531", border: "1px solid #2ecc71", color: "#2ecc71",
                  borderRadius: "50%", width: 40, height: 40, cursor: "pointer",
                  fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
                }}
                title="Épingler ce graphique"
              >
                📌
              </button>
            </div>

            {/* 2. Vue Snapshot (Grille) */}
            <OccupancySnapshot data={floorFilteredData} />

            {/* 3. Tableau Détaillé */}
            <OccupancyTable 
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

export default Occupation;