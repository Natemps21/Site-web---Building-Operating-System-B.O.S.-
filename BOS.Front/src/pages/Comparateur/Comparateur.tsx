import React from "react";
import { useComparison } from "../../context/ComparisonContext";
import TemperatureChart from "../../components/charts/TemperatureChart";
import WaterChart from "../../components/charts/WaterChart";
import EnergyChart from "../../components/charts/EnergyChart";
import OccupancyChart from "../../components/charts/OccupancyChart";

const Comparateur: React.FC = () => {
  const { widgets, removeWidget, clearAll } = useComparison();

  // Fonction factice pour satisfaire les props des composants
  const dummyDateHandler = () => {};
  const dummyDateRange = { start: "", end: "" };

  return (
    <div style={{ 
      minHeight: "100vh", 
      padding: "40px", 
      color: "#fff", 
      background: "#171924",
      // CORRECTION ICI : On décale le contenu vers la droite pour ne pas être sous la Navbar
      marginLeft: "220px",
      transition: "margin-left 0.2s" // Pour faire joli si tu animes le menu plus tard
    }}>
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "2rem" }}>Comparateur 📌</h1>
          <p style={{ margin: "5px 0 0 0", color: "#8ad6e6", opacity: 0.7 }}>
            Analysez vos graphiques épinglés côte à côte.
          </p>
        </div>
        
        {widgets.length > 0 && (
          <button 
            onClick={clearAll} 
            style={{ 
              background: "#ff4757", color: "#fff", border: "none", 
              padding: "10px 20px", borderRadius: 8, cursor: "pointer", 
              fontWeight: "bold", boxShadow: "0 4px 15px rgba(255, 71, 87, 0.3)"
            }}
          >
            Tout effacer 🗑️
          </button>
        )}
      </div>

      {widgets.length === 0 ? (
        <div style={{ 
          textAlign: "center", padding: "100px 20px", 
          opacity: 0.5, fontStyle: "italic", 
          border: "2px dashed #444", borderRadius: 20 
        }}>
          <h2>Votre comparateur est vide.</h2>
          <p>Allez sur les pages de données (Température, Eau...) et cliquez sur le bouton 📌 en bas à gauche des graphiques pour les ajouter ici.</p>
        </div>
      ) : (
        <div style={{ 
          display: "grid", 
          // Responsive : 1 colonne sur petit écran, 2 colonnes sur grand écran
          gridTemplateColumns: "repeat(auto-fit, minmax(600px, 1fr))", 
          gap: 30 
        }}>
          {widgets.map((w) => (
            <div key={w.id} style={{ position: "relative", background: "#222531", borderRadius: 16, padding: 10, border: "1px solid #444", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              
              {/* Bouton Supprimer le widget */}
              <button 
                onClick={() => removeWidget(w.id)}
                style={{ 
                  position: "absolute", top: 15, right: 15, zIndex: 10, 
                  background: "#ff4757", border: "none", color: "#fff", 
                  width: 32, height: 32, borderRadius: "50%", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem"
                }}
                title="Retirer ce graphique"
              >
                ×
              </button>

              {/* Rendu conditionnel selon le type */}
              <div style={{ marginTop: 20 }}>
                {w.type === "temp" && <TemperatureChart title={w.title} data={w.data} />}
                {w.type === "water" && <WaterChart data={w.data} dateRange={dummyDateRange} onDateChange={dummyDateHandler} />}
                {w.type === "elec" && <EnergyChart data={w.data} dateRange={dummyDateRange} onDateChange={dummyDateHandler} />}
                {w.type === "occ" && <OccupancyChart data={w.data} dateRange={dummyDateRange} onDateChange={dummyDateHandler} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Comparateur;