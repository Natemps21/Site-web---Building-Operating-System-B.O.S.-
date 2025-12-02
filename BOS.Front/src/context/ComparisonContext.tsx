import React, { createContext, useContext, useState, type ReactNode } from "react";

// On définit ce qu'est un "Widget" (un graph épinglé)
export type WidgetType = "temp" | "water" | "elec" | "occ";

export interface ComparisonWidget {
  id: string;
  type: WidgetType;
  title: string;
  data: any[]; // On stocke les données brutes pour que le graph puisse se recalculer
}

interface ComparisonContextType {
  widgets: ComparisonWidget[];
  addWidget: (widget: Omit<ComparisonWidget, "id">) => void;
  removeWidget: (id: string) => void;
  clearAll: () => void;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export const ComparisonProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [widgets, setWidgets] = useState<ComparisonWidget[]>([]);

  const addWidget = (widget: Omit<ComparisonWidget, "id">) => {
    const newWidget = { ...widget, id: Date.now().toString() };
    setWidgets(prev => [...prev, newWidget]);
    alert("Graphique ajouté au Comparateur ! 📌");
  };

  const removeWidget = (id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  };

  const clearAll = () => setWidgets([]);

  return (
    <ComparisonContext.Provider value={{ widgets, addWidget, removeWidget, clearAll }}>
      {children}
    </ComparisonContext.Provider>
  );
};

export const useComparison = () => {
  const context = useContext(ComparisonContext);
  if (!context) throw new Error("useComparison must be used within a ComparisonProvider");
  return context;
};