import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import type { OccupancyRow } from "../../hooks/useOccupancyData";

interface Props {
  data: OccupancyRow[];
  dateRange: { start: string; end: string };
  selectedFloors: string[];
}

type SortConfig = { key: keyof OccupancyRow; direction: "asc" | "desc" } | null;

const OccupancyDataTable: React.FC<Props> = ({ data, dateRange, selectedFloors }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const itemsPerPage = 10;

  const processedData = useMemo(() => {
    let res = data;

    // 1. Filtre Etage
    if (selectedFloors.length > 0) {
      res = res.filter(d => selectedFloors.includes(d.floor));
    }
    
    // 2. Filtre Date
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      res = res.filter(d => d.timestamp.getTime() >= s && d.timestamp.getTime() <= e);
    }

    // 3. Filtre Recherche (AMÉLIORÉ)
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      res = res.filter(d => 
        (d.alias || "").toLowerCase().includes(lower) ||        // Recherche par Alias
        (d.designation || "").toLowerCase().includes(lower) ||  // Recherche par Désignation
        (d.room || "").toLowerCase().includes(lower) ||         // Recherche par Code Salle (ex: 01-06-S)
        d.sensor_uid.toLowerCase().includes(lower)              // Recherche par ID Capteur
      );
    }

    // 4. Tri
    if (sortConfig) {
      res = [...res].sort((a, b) => {
        // @ts-ignore
        const valA = a[sortConfig.key];
        // @ts-ignore
        const valB = b[sortConfig.key];
        
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return res;
  }, [data, dateRange, selectedFloors, searchTerm, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = processedData.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (key: keyof OccupancyRow) => {
    setSortConfig(c => (c && c.key === key ? { key, direction: c.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" }));
  };

  const getSortIcon = (key: keyof OccupancyRow) => sortConfig?.key !== key ? <span style={{opacity:0.3}}>⇅</span> : (sortConfig.direction === "asc" ? "▲" : "▼");

  if (!data || data.length === 0) return null;

  return (
    <div style={{ background: "#222531", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
      
      {/* Header avec Recherche */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ margin: 0, color: "#e6f2ff" }}>
          Historique <span style={{fontSize: "0.8em", opacity: 0.6}}>({processedData.length})</span>
        </h3>
        <input 
          type="text" 
          placeholder="Rechercher (Salle, Alias, ID...)" 
          value={searchTerm} 
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
          style={{ background: "#171924", border: "1px solid #444", borderRadius: 6, padding: "8px 12px", color: "#fff", width: 280 }} 
        />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", color: "#dbe6f6", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #ffffff20", textAlign: "left" }}>
            <th onClick={() => handleSort("timestamp")} style={{ padding: "12px 8px", cursor: "pointer" }}>Date {getSortIcon("timestamp")}</th>
            <th onClick={() => handleSort("alias")} style={{ padding: "12px 8px", cursor: "pointer" }}>Alias {getSortIcon("alias")}</th>
            <th onClick={() => handleSort("room")} style={{ padding: "12px 8px", cursor: "pointer" }}>Code Salle {getSortIcon("room")}</th>
            <th onClick={() => handleSort("isOccupied")} style={{ padding: "12px 8px", cursor: "pointer" }}>État {getSortIcon("isOccupied")}</th>
            <th onClick={() => handleSort("designation")} style={{ padding: "12px 8px", cursor: "pointer" }}>Désignation {getSortIcon("designation")}</th>
            <th onClick={() => handleSort("floor")} style={{ padding: "12px 8px", cursor: "pointer" }}>Etage {getSortIcon("floor")}</th>
          </tr>
        </thead>
        <tbody>
          {currentData.map((row) => (
            <tr key={row.id} style={{ borderBottom: "1px solid #ffffff08" }}>
              <td style={{ padding: "10px 8px" }}>{format(row.timestamp, "dd/MM HH:mm:ss")}</td>
              <td style={{ padding: "10px 8px", fontWeight: "bold", color: "#2ecc71" }}>{row.alias}</td>
              <td style={{ padding: "10px 8px", opacity: 0.7 }}>{row.room}</td>
              <td style={{ padding: "10px 8px" }}>
                <span style={{ 
                  background: row.isOccupied ? "rgba(46, 204, 113, 0.2)" : "rgba(255,255,255,0.1)", 
                  color: row.isOccupied ? "#2ecc71" : "#aaa",
                  padding: "2px 8px", borderRadius: 4, fontSize: "0.8rem", fontWeight: "bold"
                }}>
                  {row.isOccupied ? "OCCUPÉ" : "LIBRE"}
                </span>
              </td>
              <td style={{ padding: "10px 8px" }}>{row.designation}</td>
              <td style={{ padding: "10px 8px" }}>{row.floor}</td>
            </tr>
          ))}
          {currentData.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", padding: 30, opacity: 0.5 }}>Aucun résultat trouvé</td>
            </tr>
          )}
        </tbody>
      </table>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ background: "#171924", border: "1px solid #444", color: "#fff", padding: "6px 16px", borderRadius: 6, opacity: currentPage === 1 ? 0.5 : 1 }}>Précédent</button>
          <span style={{ opacity: 0.7 }}>Page {currentPage} / {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ background: "#171924", border: "1px solid #444", color: "#fff", padding: "6px 16px", borderRadius: 6, opacity: currentPage === totalPages ? 0.5 : 1 }}>Suivant</button>
        </div>
      )}
    </div>
  );
};

export default OccupancyDataTable;