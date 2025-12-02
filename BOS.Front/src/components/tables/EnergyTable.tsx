import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import type { EnergyRow } from "../../hooks/useEnergyData";

interface Props {
  data: EnergyRow[];
  dateRange: { start: string; end: string };
  selectedFloors: string[]; // Pour filtrer par étage sélectionné
}

type SortConfig = { key: keyof EnergyRow; direction: "asc" | "desc" } | null;

const EnergyDataTable: React.FC<Props> = ({ data, dateRange, selectedFloors }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const itemsPerPage = 10;

  // --- FILTRAGE & TRI ---
  const processedData = useMemo(() => {
    let res = data;

    // 1. Filtre Etage (Si sélectionné)
    if (selectedFloors.length > 0) {
      res = res.filter(d => selectedFloors.includes(d.floor));
    }

    // 2. Filtre Date
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      res = res.filter(d => d.timestamp.getTime() >= s && d.timestamp.getTime() <= e);
    }

    // 3. Recherche (Designation ou Alias ou UID)
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      res = res.filter(d => 
        (d.designation || "").toLowerCase().includes(lower) || 
        (d.alias || "").toLowerCase().includes(lower) ||
        d.sensor_uid.toLowerCase().includes(lower)
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

  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = processedData.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (key: keyof EnergyRow) => {
    setSortConfig(current => {
      if (current && current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const getSortIcon = (key: keyof EnergyRow) => {
    if (sortConfig?.key !== key) return <span style={{opacity:0.3}}>⇅</span>;
    return sortConfig.direction === "asc" ? "▲" : "▼";
  };

  if (!data || data.length === 0) return null;

  return (
    <div style={{ background: "#222531", borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ margin: 0, color: "#e6f2ff" }}>Relevés Compteurs <span style={{fontSize: "0.8em", opacity: 0.6}}>({processedData.length})</span></h3>
        <input 
          type="text" 
          placeholder="Rechercher (Désignation, Alias...)" 
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          style={{ background: "#171924", border: "1px solid #444", borderRadius: 6, padding: "8px 12px", color: "#fff", width: 250 }}
        />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", color: "#dbe6f6", fontSize: "0.9rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #ffffff20", textAlign: "left" }}>
            <th onClick={() => handleSort("timestamp")} style={{ padding: "12px 8px", cursor: "pointer" }}>Date {getSortIcon("timestamp")}</th>
            <th onClick={() => handleSort("sensor_uid")} style={{ padding: "12px 8px", cursor: "pointer" }}>UID {getSortIcon("sensor_uid")}</th>
            <th onClick={() => handleSort("alias")} style={{ padding: "12px 8px", cursor: "pointer" }}>Alias {getSortIcon("alias")}</th>
            <th onClick={() => handleSort("designation")} style={{ padding: "12px 8px", cursor: "pointer" }}>Désignation {getSortIcon("designation")}</th>
            <th onClick={() => handleSort("zone")} style={{ padding: "12px 8px", cursor: "pointer" }}>Zone {getSortIcon("zone")}</th>
            <th onClick={() => handleSort("energyIndex")} style={{ padding: "12px 8px", textAlign: "right", cursor: "pointer" }}>Index (kWh) {getSortIcon("energyIndex")}</th>
          </tr>
        </thead>
        <tbody>
          {currentData.map((row) => (
            <tr key={row.id} style={{ borderBottom: "1px solid #ffffff08" }}>
              <td style={{ padding: "10px 8px" }}>{format(row.timestamp, "dd/MM HH:mm")}</td>
              <td style={{ padding: "10px 8px", opacity: 0.7 }}>{row.sensor_uid}</td>
              <td style={{ padding: "10px 8px", fontWeight: "bold", color: "#f1c40f" }}>{row.alias || "-"}</td>
              <td style={{ padding: "10px 8px" }}>{row.designation}</td>
              <td style={{ padding: "10px 8px" }}>{row.zone}</td>
              <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace" }}>{row.energyIndex}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} style={{ background: "#171924", border: "1px solid #444", color: "#fff", padding: "6px 16px", borderRadius: 6, opacity: currentPage === 1 ? 0.5 : 1 }}>Précédent</button>
          <span style={{ fontSize: "0.9rem", opacity: 0.7 }}>Page {currentPage} / {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} style={{ background: "#171924", border: "1px solid #444", color: "#fff", padding: "6px 16px", borderRadius: 6, opacity: currentPage === totalPages ? 0.5 : 1 }}>Suivant</button>
        </div>
      )}
    </div>
  );
};

export default EnergyDataTable;