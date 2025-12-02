import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import type { OccupancyRow } from "../../hooks/useOccupancyData";

interface Props {
  data: OccupancyRow[];
}

const OccupancySnapshot: React.FC<Props> = ({ data }) => {
  // Date par défaut : maintenant (ou la dernière date du fichier)
  const [snapshotTime, setSnapshotTime] = useState<string>("");

  // Init date si vide
  if (!snapshotTime && data.length > 0) {
    const lastDate = data[data.length - 1].timestamp;
    setSnapshotTime(format(lastDate, "yyyy-MM-dd'T'HH:mm"));
  }

  // --- LOGIQUE SNAPSHOT ---
  // Trouver l'état de chaque salle à l'instant T
  const snapshotData = useMemo(() => {
    if (!snapshotTime) return [];
    
    const targetTime = new Date(snapshotTime).getTime();
    const statusMap = new Map<string, boolean>(); // Alias -> Status

    // On parcourt toutes les données pour trouver la dernière valeur connue avant targetTime pour chaque salle
    // Comme data est souvent trié par temps, on peut optimiser, mais ici on fait simple :
    // On groupe par salle, on trie, on prend le dernier avant T.
    
    const roomGroups: { [alias: string]: OccupancyRow[] } = {};
    data.forEach(d => {
      if (!roomGroups[d.alias]) roomGroups[d.alias] = [];
      roomGroups[d.alias].push(d);
    });

    const result: { alias: string, isOccupied: boolean, zone: string }[] = [];

    Object.keys(roomGroups).forEach(alias => {
      const rows = roomGroups[alias];
      // On cherche le relevé le plus proche dans le passé ou présent
      // On suppose que rows est dans le désordre, on trie
      rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      let status = false; // Par défaut libre si pas de donnée
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].timestamp.getTime() <= targetTime) {
          status = rows[i].isOccupied;
        } else {
          break; // On a dépassé l'heure cible
        }
      }
      result.push({ alias, isOccupied: status, zone: rows[0].zone });
    });

    return result.sort((a, b) => a.alias.localeCompare(b.alias));
  }, [data, snapshotTime]);

  const occupiedCount = snapshotData.filter(d => d.isOccupied).length;

  return (
    <div style={{ background: "#222531", borderRadius: 16, padding: 24, marginBottom: 32, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 15 }}>
        <div>
          <h3 style={{ margin: 0, color: "#2ecc71" }}>État en temps réel (Snapshot)</h3>
          <div style={{ fontSize: "0.9rem", color: "#8ad6e6", opacity: 0.8, marginTop: 4 }}>
            À l'instant sélectionné : <b>{occupiedCount}</b> salles occupées sur {snapshotData.length}
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#aaa", fontSize: "0.9rem" }}>Voir l'état à :</span>
          <input 
            type="datetime-local" 
            value={snapshotTime} 
            onChange={(e) => setSnapshotTime(e.target.value)}
            style={{ background: "#171924", border: "1px solid #444", color: "#fff", padding: "6px 12px", borderRadius: 8, colorScheme: "dark", cursor: "pointer" }}
          />
        </div>
      </div>

      {/* GRILLE VISUELLE */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
        {snapshotData.map((room) => (
          <div 
            key={room.alias}
            style={{
              background: room.isOccupied ? "rgba(46, 204, 113, 0.2)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${room.isOccupied ? "#2ecc71" : "#444"}`,
              borderRadius: 8,
              padding: "12px",
              textAlign: "center",
              transition: "all 0.2s"
            }}
          >
            <div style={{ fontWeight: "bold", color: room.isOccupied ? "#2ecc71" : "#aaa", fontSize: "1.1rem", marginBottom: 4 }}>
              {room.alias}
            </div>
            <div style={{ fontSize: "0.75rem", color: "#666", textTransform: "uppercase" }}>
              {room.isOccupied ? "Occupé" : "Libre"}
            </div>
          </div>
        ))}
        {snapshotData.length === 0 && <div style={{ color: "#666", fontStyle: "italic" }}>Aucune salle trouvée à cette date.</div>}
      </div>

    </div>
  );
};

export default OccupancySnapshot;