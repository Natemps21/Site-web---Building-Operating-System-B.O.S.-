import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import type { WaterRow } from "../../hooks/useWaterData";

interface Props {
  data: WaterRow[];
  dateRange: { start: string; end: string }; // Reçu du parent
}

type SortConfig = { key: keyof WaterRow; direction: "asc" | "desc" } | null;

const WaterDataTable: React.FC<Props> = ({ data, dateRange }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const itemsPerPage = 10;

  // --- FILTRAGE & TRI ---
  const processedData = useMemo(() => {
    let res = data;

    // 1. Filtre Date (Prioritaire, synchro avec graph)
    if (dateRange.start && dateRange.end) {
      const s = new Date(dateRange.start).getTime();
      const e = new Date(dateRange.end).getTime();
      res = res.filter(d => d.timestamp.getTime() >= s && d.timestamp.getTime() <= e);
    }

    // 2. Filtre Recherche (Override local)
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      res = res.filter(d => d.display_name.toLowerCase().includes(lower));
    }

    // 3. Tri
    if (sortConfig) {
      res = [...res].sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        
        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return res;
  }, [data, dateRange, searchTerm, sortConfig]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentData = processedData.slice(startIndex, startIndex + itemsPerPage);

  // Helpers
  const handleSort = (key: keyof WaterRow) => {
    setSortConfig(current => {
      if (current && current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const getSortIcon = (key: keyof WaterRow) => {
    if (sortConfig?.key !== key) return <span style={{opacity:0.3}}>⇅</span>;
    return sortConfig.direction === "asc" ? "▲" : "▼";
  };

  if (!data || data.length === 0) return null;

  return (
    <div style={{ 
      background: "#222531", borderRadius: 16, padding: 24, 
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" 
    }}>
      
      {/* Header Tableau */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ margin: 0, color: "#e6f2ff" }}>
          Relevés Détaillés <span style={{fontSize: "0.8em", opacity: 0.6, fontWeight: 400}}>({processedData.length})</span>
        </h3>
        
        {/* Barre de Recherche */}
        <input 
          type="text" 
          placeholder="Rechercher un capteur..." 
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          style={{
            background: "#171924", border: "1px solid #444", borderRadius: 6,
            padding: "8px 12px", color: "#fff", width: 250
          }}
        />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", color: "#dbe6f6" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #ffffff20", textAlign: "left" }}>
            <th 
              onClick={() => handleSort("timestamp")}
              style={{ padding: "12px 8px", color: "#8ad6e6", cursor: "pointer", userSelect: "none" }}
            >
              Horodatage {getSortIcon("timestamp")}
            </th>
            <th 
              onClick={() => handleSort("display_name")}
              style={{ padding: "12px 8px", color: "#8ad6e6", cursor: "pointer", userSelect: "none" }}
            >
              Capteur {getSortIcon("display_name")}
            </th>
            <th 
              onClick={() => handleSort("value")}
              style={{ padding: "12px 8px", color: "#8ad6e6", textAlign: "right", cursor: "pointer", userSelect: "none" }}
            >
              Volume (L) {getSortIcon("value")}
            </th>
          </tr>
        </thead>
        <tbody>
          {currentData.map((row) => (
            <tr key={row.id} style={{ borderBottom: "1px solid #ffffff08" }}>
              <td style={{ padding: "10px 8px" }}>
                {format(row.timestamp, "dd/MM/yyyy")} <span style={{ opacity: 0.5, marginLeft: 6 }}>{format(row.timestamp, "HH:mm:ss")}</span>
              </td>
              <td style={{ padding: "10px 8px" }}>{row.display_name}</td>
              <td style={{ padding: "10px 8px", textAlign: "right", fontFamily: "monospace", fontSize: "1.1em" }}>
                {row.value}
              </td>
            </tr>
          ))}
          {currentData.length === 0 && (
            <tr>
              <td colSpan={3} style={{ textAlign: "center", padding: 30, opacity: 0.5 }}>Aucun résultat</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
            disabled={currentPage === 1}
            style={{ background: "#171924", border: "1px solid #444", color: "#fff", padding: "6px 16px", borderRadius: 6, cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.5 : 1 }}
          >
            Précédent
          </button>
          
          <span style={{ fontSize: "0.9rem", opacity: 0.7 }}>
            Page {currentPage} sur {totalPages}
          </span>

          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
            disabled={currentPage === totalPages}
            style={{ background: "#171924", border: "1px solid #444", color: "#fff", padding: "6px 16px", borderRadius: 6, cursor: currentPage === totalPages ? "not-allowed" : "pointer", opacity: currentPage === totalPages ? 0.5 : 1 }}
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
};

export default WaterDataTable;