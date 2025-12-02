import { useState, useEffect } from "react";

export type WaterRow = {
  id: number; // Utile pour les clés React dans le tableau
  timestamp: Date;
  timestampStr: string;
  display_name: string;
  value: number;
};

export const useWaterData = (fileName: string) => {
  const [data, setData] = useState<WaterRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/Fichier_Clean/${fileName}`)
      .then(res => {
        if (!res.ok) throw new Error("Fichier introuvable");
        return res.text();
      })
      .then(text => {
        const lines = text.split(/\r?\n/).slice(1);
        
        const parsedData = lines.map((line, index) => {
          if (!line.trim()) return null;
          const cols = line.includes(";") ? line.split(";") : line.split(",");
          
          // On attend au moins 3 colonnes : timestamp, name, value
          if (cols.length < 3) return null;

          const dateStr = cols[0].trim();
          const d = new Date(dateStr);
          
          if (isNaN(d.getTime())) return null;

          return {
            id: index,
            timestamp: d,
            timestampStr: dateStr,
            display_name: cols[1]?.trim() || "Compteur Principal",
            value: parseFloat(cols[2]) || 0
          };
        }).filter(r => r !== null) as WaterRow[];

        setData(parsedData);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [fileName]);

  return { data, loading };
};