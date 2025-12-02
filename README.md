# 🏢 BOS - Building Operating System

Un tableau de bord intelligent pour la gestion technique de bâtiment, permettant de visualiser et d'analyser les consommations d'eau, d'électricité, la température et l'occupation des salles.


## 🚀 Fonctionnalités

- **Visualisation de données** : Graphiques interactifs (Recharts) avec zoom et échantillonnage dynamique.
- **Analyse IA (Gemini)** : Chatbot intégré capable d'analyser les données affichées en temps réel (RAG).
- **Comparateur** : Système d'épinglage pour comparer des graphiques de différentes sources.
- **Gestion de fichiers** : Upload et nettoyage automatique de fichiers CSV bruts via une API .NET.

## 🛠️ Stack Technique

- **Frontend** : React, TypeScript, Vite, Recharts.
- **Backend** : .NET Core (C#), API REST.
- **IA** : Google Gemini API.

## ⚙️ Installation

### 1. Backend (.NET)
1. Ouvrir `BOS.Api`.
2. Lancer le projet (`dotnet run`). L'API tourne sur `http://localhost:5113`.

### 2. Frontend (React)
1. Ouvrir `BOS.Front`.
2. Installer les dépendances : `npm install`.
3. Créer un fichier `.env` à la racine du Front et ajouter votre clé API Gemini :
   `VITE_GEMINI_API_KEY=VOTRE_CLE_ICI`
4. Lancer le projet : `npm run dev`.

## 📂 Structure des données
Le projet fonctionne avec des fichiers CSV locaux stockés dans `public/Fichier_Clean`.
Possibilité de nettoyager les données se trouvant dans `Fichier_Brut`.
Les fichiers Brut (contenant toutes les informations, avant le nettoyage) ne sont pas fourni. Les fichier Clean non plus.

Le fichier Ref sert à retrouver le nom des salle (alias) et la fonction des salles (désignation).
Il n'est pas fourni non plus dans ce depôt
