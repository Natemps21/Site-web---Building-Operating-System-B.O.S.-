import { useState, useEffect } from "react";

export type TempRow = {
  timestamp: Date;
  timestampStr: string;
  sensor_uid: string;
  temperature: number;
  isValidSensor: boolean;
  room: string;
  floor: string;
  zone: string;
  alias: string;
  designation: string;
};

export const useTemperatureData = (files: { key: string; file: string }[]) => {
  const [data, setData] = useState<{ [key: string]: TempRow[] }>({});
  const [loadedCount, setLoadedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setLoadedCount(0);

    Promise.all(
      files.map(fileObj => {
        return fetch(`/Fichier_Clean/${fileObj.file}`)
          .then(res => {
            if (!res.ok) throw new Error("File not found");
            return res.text();
          })
          .then(text => {
            const lines = text.split(/\r?\n/).slice(1); 
            
            const rows: TempRow[] = lines.map(line => {
              if (!line.trim()) return null;
              const cols = line.includes(";") ? line.split(";") : line.split(",");
              if (cols.length < 5) return null;
              
              const dateStr = cols[0].trim();
              const d = new Date(dateStr);

              if (isNaN(d.getTime())) return null;

              const tempVal = parseFloat(cols[2]);

              return {
                timestamp: d,
                timestampStr: dateStr,
                sensor_uid: cols[1],
                temperature: isNaN(tempVal) ? 0 : tempVal,
                isValidSensor: cols[3]?.trim().toLowerCase() === "true",
                room: cols[4]?.trim() || "Inconnue",
                floor: cols[5]?.trim(),
                zone: cols[6]?.trim(),
                alias: cols[7]?.trim(),
                designation: cols[8]?.trim()
              };
            }).filter(r => r !== null) as TempRow[];

            // --- OPTIMISATION CRUCIALE ---
            // On trie les données UNE SEULE FOIS ici.
            // Le graphique n'aura plus à le faire à chaque render.
            rows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

            setLoadedCount(prev => prev + 1);

            return { key: fileObj.key, rows };
          })
          .catch(err => {
            console.error(`Erreur chargement ${fileObj.key}:`, err);
            return { key: fileObj.key, rows: [] };
          });
      })
    ).then(results => {
      const newData: { [key: string]: TempRow[] } = {};
      results.forEach(r => {
        newData[r.key] = r.rows;
      });
      setData(newData);
      setLoading(false);
    });

  }, [files]);

  return { data, loading, loadedCount, totalCount: files.length };
};