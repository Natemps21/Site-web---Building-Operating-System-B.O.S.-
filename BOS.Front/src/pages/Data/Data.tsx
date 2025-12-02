import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

const links = [
  { to: "/donnees/temperature", label: "Température" },
  { to: "/donnees/eau", label: "Eau" },
  { to: "/donnees/electricite", label: "Électricité" },
    { to: "/donnees/occupation", label: "Occupation" }
];

const Data: React.FC = () => {
  const location = useLocation();

  return (
    <div style={{ marginLeft: 220, padding: 32 }}>
      <h2>Données</h2>
      <nav style={{ marginBottom: 20, display: "flex", gap: 16 }}>
        {links.map(link => (
          <Link
            key={link.to}
            to={link.to}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              background: location.pathname === link.to ? "#242731" : "#ececec",
              color: location.pathname === link.to ? "white" : "#242731",
              textDecoration: "none"
            }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
};

export default Data;
