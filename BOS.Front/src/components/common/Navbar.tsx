import React, { useState } from "react";
import styles from "./Navbar.module.css";
import { Link } from "react-router-dom";

const Navbar: React.FC = () => {
  const [open, setOpen] = useState(true);

  return (
    <nav className={open ? styles.sidebarOpen : styles.sidebarClosed}>
      <button className={styles.burgerButton} onClick={() => setOpen(!open)}>
        &#9776;
      </button>
      <div className={styles.menuLinks}>
        <Link to="/" className={styles.menuLink}>
          Accueil
        </Link>
        <Link to="/donnees" className={styles.menuLink}>
          Données
        </Link>
        <Link to="/comparateur" className={styles.menuLink}>Comparateur</Link>

        <Link to="/nettoyage" className={styles.menuLink}>
          Nettoyage
        </Link>
      </div>
    </nav>
  );
};

export default Navbar;
