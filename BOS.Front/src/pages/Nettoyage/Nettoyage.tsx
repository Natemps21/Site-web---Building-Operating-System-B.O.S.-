import React, { useEffect, useState } from "react";
import styles from "./Nettoyage.module.css";
import { apiService } from "../../services/api"; // Import du service

type FileItem = { name: string };

const Nettoyage: React.FC = () => {
  const [brutFiles, setBrutFiles] = useState<FileItem[]>([]);
  const [cleanFiles, setCleanFiles] = useState<FileItem[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [reload, setReload] = useState(0);

  // Rafraîchir tout
  const refreshAll = async () => {
    try {
      const bruts = await apiService.getBrutFiles();
      setBrutFiles(bruts.map((name) => ({ name })));

      const cleans = await apiService.getCleanFiles();
      setCleanFiles(cleans.map((name) => ({ name })));

      const logsData = await apiService.getLogs();
      setLogs(logsData);
    } catch (error) {
      console.error("Erreur chargement:", error);
    }
  };

  useEffect(() => {
    refreshAll();
  }, [reload]);

  // Actions
  const removeBrut = async (name: string) => {
    if (window.confirm(`Supprimer ${name} ?`)) {
      await apiService.deleteBrutFile(name);
      setReload((x) => x + 1);
    }
  };

  const removeClean = async (name: string) => {
    if (window.confirm(`Supprimer ${name} ?`)) {
      await apiService.deleteCleanFile(name);
      setReload((x) => x + 1);
    }
  };

  const handleAddBrut = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    
    await apiService.uploadBrutFiles(form);
    setReload((x) => x + 1);
    e.target.value = "";
  };

  const handleNettoyer = async () => {
    const data = await apiService.cleanFiles(false); // false = pas d'overwrite par défaut

    if (data.status === "no-file") {
      alert(data.message);
    } else if (data.status === "already-exist") {
      if (window.confirm(data.message + "\n" + data.alreadyExist.join("\n") + "\nÉcraser ces fichiers ?")) {
        const data2 = await apiService.cleanFiles(true); // true = overwrite
        alert("Terminé : " + (data2.created?.join(", ") || "Aucun"));
      }
    } else if (data.status === "ok") {
      alert("Nettoyage réussi : " + (data.created?.join(", ") || "Aucun"));
    }
    setReload((x) => x + 1);
  };

  return (
    <div className={styles.wrapper} style={{ display: "flex", gap: 30 }}>
      {/* ... LE RESTE DU JSX RESTE IDENTIQUE (Affichage des listes) ... */}
      {/* Je ne remets pas tout le HTML pour ne pas surcharger, garde ton JSX actuel */}
      {/* Juste vérifie que tu utilises bien les fonctions removeBrut, removeClean, etc. */}
      
      {/* Colonne Brut */}
      <div className={styles.section} style={{ flex: 1 }}>
        <h2 className={styles.title}>Fichiers Bruts</h2>
        <div style={{ display: "flex", gap: 14 }}>
          <input type="file" multiple className={styles.fileInput} onChange={handleAddBrut} id="fileBrutFile" />
          <label htmlFor="fileBrutFile" className={styles.buttonBrowse}>Fichiers</label>
        </div>
        <ul className={styles.table}>
          {brutFiles.map(f => (
            <li key={f.name} className={styles.row}>
              <span>{f.name}</span>
              <button className={styles.deleteBtn} onClick={() => removeBrut(f.name)}>❌</button>
            </li>
          ))}
        </ul>
      </div>

      {/* Colonne Clean */}
      <div className={styles.section} style={{ flex: 1 }}>
        <h2 className={styles.title}>Fichiers Nettoyés</h2>
        <ul className={styles.table}>
          {cleanFiles.map(f => (
            <li key={f.name} className={styles.row}>
              <span>{f.name}</span>
              <button className={styles.deleteBtn} onClick={() => removeClean(f.name)}>❌</button>
            </li>
          ))}
        </ul>
      </div>

      {/* Logs */}
      <div style={{ minWidth: 270, background: "#23252e", color: "#c8eae9", padding: "14px 24px", borderRadius: 12, alignSelf: "flex-start" }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Dernières actions</h3>
        {logs.map((log, idx) => (
          <div key={idx} style={{ fontSize: 15, marginTop: idx > 0 ? 20 : 0, whiteSpace: "pre-line" }}>{log}</div>
        ))}
      </div>

      {/* Bouton Action */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 38, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <button className={styles.buttonAction} style={{ minWidth: 250, pointerEvents: "auto" }} onClick={handleNettoyer}>
          Nettoyer
        </button>
      </div>
    </div>
  );
};

export default Nettoyage;