import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";
import styles from "./Home.module.css";

// Préchargement
useGLTF.preload("/maquette.glb");

const Maquette = () => {
  const gltf = useGLTF("/maquette.glb");
  return (
    <primitive
      object={gltf.scene}
      position={[70, 4, 30]}         // centré
      rotation={[0, Math.PI / -2, 0]}
      scale={[2, 2, 2]}            // agrandit, adapte si besoin
    />
  );
};

const Home: React.FC = () => (
  <div className={styles.homeWrapper}>
    <h1 className={styles.heroTitle}>Building Operating System</h1>
    <div className={styles.canvasBlock}>
      <Canvas
        style={{ width: "100%", height: "100%" }}          // force la taille
        camera={{ position: [120, 100, 120], fov: 40 }}      // vise le centre
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Suspense fallback={<Html center>Chargement...</Html>}>
          <Maquette />
        </Suspense>
        <OrbitControls enablePan enableRotate enableZoom target={[0, 0, 0]} /> {/* centre le zoom */}
      </Canvas>
    </div>
  </div>
);

export default Home;
