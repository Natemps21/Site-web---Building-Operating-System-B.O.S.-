// src/services/api.ts

const API_BASE_URL = "http://localhost:5113/api/FileManager";

// Helper pour gérer les réponses
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Erreur API");
  }
  // Si le contenu est vide (ex: delete), on retourne null
  const text = await response.text();
  return text ? JSON.parse(text) : null;
};

export const apiService = {
  // --- FICHIERS BRUTS ---
  getBrutFiles: async (): Promise<string[]> => {
    const res = await fetch(`${API_BASE_URL}/brut/files`);
    return handleResponse(res);
  },

  uploadBrutFiles: async (formData: FormData) => {
    const res = await fetch(`${API_BASE_URL}/brut/upload`, {
      method: "POST",
      body: formData,
    });
    return handleResponse(res);
  },

  deleteBrutFile: async (name: string) => {
    const res = await fetch(`${API_BASE_URL}/brut/file?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    return handleResponse(res);
  },

  // --- FICHIERS CLEAN ---
  getCleanFiles: async (): Promise<string[]> => {
    const res = await fetch(`${API_BASE_URL}/clean/files`);
    return handleResponse(res);
  },

  deleteCleanFile: async (name: string) => {
    const res = await fetch(`${API_BASE_URL}/clean/file?name=${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
    return handleResponse(res);
  },

  // --- ACTIONS ---
  cleanFiles: async (overwrite = false) => {
    const res = await fetch(`${API_BASE_URL}/nettoyer?overwrite=${overwrite}`, {
      method: "POST",
    });
    return handleResponse(res);
  },

  getLogs: async (): Promise<string[]> => {
    const res = await fetch(`${API_BASE_URL}/logactions`);
    return handleResponse(res);
  },
};