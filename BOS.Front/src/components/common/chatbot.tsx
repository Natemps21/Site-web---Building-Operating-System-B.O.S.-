import React, { useState, useEffect, useRef } from "react";
// On utilise GoogleGenerativeAI (il faut installer le package, voir plus bas)
import { GoogleGenerativeAI } from "@google/generative-ai";


// Types pour les messages
type Message = {
  id: number;
  text: string;
  sender: "user" | "bot";
};

interface ChatbotProps {
  // Les données que le chatbot doit "connaître" (ex: KPI actuels)
  contextData: string; 
}

const Chatbot: React.FC<ChatbotProps> = ({ contextData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Bonjour ! Je suis l'assistant Gemini du bâtiment. Posez-moi une question sur les données affichées.", sender: "bot" }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Récupération de la clé depuis le fichier .env
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  // Auto-scroll vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // 1. Ajouter le message utilisateur
    const userMsg: Message = { id: Date.now(), text: input, sender: "user" };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      if (!API_KEY) {
        throw new Error("Clé API Gemini manquante dans le fichier .env");
      }

      // 2. CONFIGURATION GEMINI
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" }); // Modèle rapide et gratuit

      // 3. CONSTRUCTION DU PROMPT (Contexte + Question)
      const prompt = `
        Tu es un expert en gestion technique de bâtiment (BOS).
        Ton rôle est d'analyser les données fournies ci-dessous et de répondre aux questions de l'utilisateur de manière concise et professionnelle.
        
        --- DONNÉES DU DASHBOARD ACTUEL ---
        ${contextData}
        -----------------------------------

        Question de l'utilisateur : "${userMsg.text}"

        Réponds en français. Si la réponse n'est pas dans les données, dis-le poliment.
      `;

      // 4. APPEL API
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // 5. AJOUT DE LA RÉPONSE BOT
      const botMsg: Message = { id: Date.now() + 1, text: text, sender: "bot" };
      setMessages(prev => [...prev, botMsg]);

    } catch (error) {
      console.error("Erreur Gemini:", error);
      const errorMsg: Message = { id: Date.now() + 1, text: "Désolé, je n'arrive pas à joindre le cerveau de Gemini pour le moment.", sender: "bot" };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 1000, fontFamily: "system-ui" }}>
      
      {/* BOUTON FLOTTANT */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          style={{
            width: 60, height: 60, borderRadius: "50%", background: "linear-gradient(135deg, #4285f4, #d96570)", color: "white",
            border: "none", boxShadow: "0 4px 15px rgba(0,0,0,0.3)", cursor: "pointer", fontSize: "1.5rem", display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >
          ✨
        </button>
      )}

      {/* FENÊTRE DE CHAT */}
      {isOpen && (
        <div style={{
          width: 350, height: 500, background: "#1e1e2e", borderRadius: 16,
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column",
          border: "1px solid #444", overflow: "hidden"
        }}>
          {/* Header */}
          <div style={{ padding: "15px", background: "linear-gradient(90deg, #4285f4, #9b59b6)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ margin: 0, color: "#fff", fontWeight: "bold" }}>✨ Assistant Gemini</h4>
            <button onClick={() => setIsOpen(false)} style={{ background: "transparent", border: "none", color: "#fff", cursor: "pointer", fontSize: "1.2rem" }}>×</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, padding: 15, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map(msg => (
              <div key={msg.id} style={{
                alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                background: msg.sender === "user" ? "#4285f4" : "#2f3640",
                color: "#fff", padding: "10px 14px", borderRadius: 12, maxWidth: "85%",
                fontSize: "0.9rem", lineHeight: "1.4",
                boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
              }}>
                {msg.text}
              </div>
            ))}
            {isTyping && <div style={{ color: "#aaa", fontSize: "0.8rem", fontStyle: "italic", marginLeft: 10 }}>Gemini réfléchit...</div>}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: 15, background: "#171924", borderTop: "1px solid #333", display: "flex", gap: 10 }}>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Posez une question..."
              style={{
                flex: 1, background: "#2f3640", border: "1px solid #444", borderRadius: 20,
                padding: "10px 15px", color: "#fff", outline: "none"
              }}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              style={{
                background: "#4285f4", color: "#fff", border: "none", borderRadius: "50%",
                width: 40, height: 40, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                opacity: (!input.trim() || isTyping) ? 0.5 : 1
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chatbot;