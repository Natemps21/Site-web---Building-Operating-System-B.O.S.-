import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/common/Navbar";
import Home from "./pages/Home/Home";
import Data from "./pages/Data/Data";
import Temperature from "./pages/Data/Temperature/TemperatureDashboard";
import Nettoyage from "./pages/Nettoyage/Nettoyage";
import Comparateur from "./pages/Comparateur/Comparateur";


// Import des vraies pages
import Eau from "./pages/Data/Eau/Eau"; 
import Electricite from "./pages/Data/Electricite/Electricite";
import Occupation from "./pages/Data/Occupation/Occupation";

function App() {
  return (
    <Router>
      <Navbar />
      <div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/donnees" element={<Data />}>
            <Route path="temperature" element={<Temperature/>} />
            <Route path="eau" element={<Eau />} />
            <Route path="electricite" element={<Electricite />} /> 
            <Route path="occupation" element={<Occupation />} /> 
          </Route>
          <Route path="/comparateur" element={<Comparateur />} />
          <Route path="/nettoyage" element={<Nettoyage />} />
          

        </Routes>

      </div>
    </Router>
  );
}

export default App;