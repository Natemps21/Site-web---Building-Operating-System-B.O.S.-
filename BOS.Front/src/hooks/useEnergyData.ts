import { useState, useEffect } from "react";

export type EnergyRow = {
  id: number;
  timestamp: Date;
  timestampStr: string;
  sensor_uid: string;
  energyIndex: number;
  room: string;
  floor: string;
  zone: string;
  alias: string;
  designation: string;
};

export const useEnergyData = (fileName: string) => {
  const [data, setData] = useState<EnergyRow[]>([]);
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
          
          // MODIFICATION ICI : On accepte à partir de 7 colonnes
          if (cols.length < 7) return null;

          const dateStr = cols[0].trim();
          const d = new Date(dateStr);
          
          if (isNaN(d.getTime())) return null;

          // --- LOGIQUE INTELLIGENTE POUR LE NOM ---
          // On vérifie si la colonne 6 (alias) existe, sinon vide
          const rawAlias = cols[6]?.trim();
          const rawZone = cols[5]?.trim();
          const rawUid = cols[1]?.trim();

          let finalAlias = rawAlias;
          if (!finalAlias || finalAlias === "") finalAlias = rawZone;
          if (!finalAlias || finalAlias === "") finalAlias = rawUid;

          return {
            id: index,
            timestamp: d,
            timestampStr: dateStr,
            sensor_uid: rawUid,
            energyIndex: parseFloat(cols[2]) || 0,
            room: cols[3]?.trim(),
            floor: cols[4]?.trim(),
            zone: rawZone,
            alias: finalAlias,
            // Si la colonne 7 (designation) n'existe pas (vieux fichier), on met une chaine vide
            designation: cols[7]?.trim() || "" 
          };
        }).filter(r => r !== null) as EnergyRow[];

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