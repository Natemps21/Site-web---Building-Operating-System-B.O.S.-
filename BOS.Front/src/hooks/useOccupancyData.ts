import { useState, useEffect } from "react";

export type OccupancyRow = {
  id: number;
  timestamp: Date;
  timestampStr: string;
  sensor_uid: string;
  isOccupied: boolean; // True = Occupé, False = Libre
  room: string;
  floor: string;
  zone: string;
  alias: string;
  designation: string;
};

export const useOccupancyData = (fileName: string) => {
  const [data, setData] = useState<OccupancyRow[]>([]);
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
          
          if (cols.length < 8) return null;

          const dateStr = cols[0].trim();
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return null;

          // Logique Nom (Alias > Zone > UID)
          const rawAlias = cols[6]?.trim();
          const rawZone = cols[5]?.trim();
          const rawUid = cols[1]?.trim();
          let finalAlias = rawAlias;
          if (!finalAlias) finalAlias = rawZone;
          if (!finalAlias) finalAlias = rawUid;

          // Parsing Booléen (Python "True" ou JS "true")
          const statusRaw = cols[2]?.trim().toLowerCase();
          const isOccupied = statusRaw === "true" || statusRaw === "1";

          return {
            id: index,
            timestamp: d,
            timestampStr: dateStr,
            sensor_uid: rawUid,
            isOccupied: isOccupied,
            room: cols[3]?.trim(),
            floor: cols[4]?.trim(),
            zone: rawZone,
            alias: finalAlias,
            designation: cols[7]?.trim()
          };
        }).filter(r => r !== null) as OccupancyRow[];

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