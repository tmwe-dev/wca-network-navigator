/**
 * Globe Zoom Controller - Standalone hook for React Three Fiber
 * 
 * Gestisce zoom cinematografico, auto-rotazione e reset fluido per un globo 3D.
 * 
 * Dipendenze: three (>=0.133), @react-three/fiber (^8.18)
 * 
 * Uso:
 *   import { useGlobeZoom } from './globe-zoom-controller';
 * 
 *   function Earth() {
 *     const earthRef = useRef<THREE.Group>(null);
 *     const { camera } = useThree();
 *     const { zoomTo, resetZoom, applyFrame, onUserInteract } = useGlobeZoom();
 * 
 *     useFrame((state, delta) => {
 *       applyFrame(earthRef, camera, state.clock.elapsedTime, delta);
 *     });
 * 
 *     // Zoom verso Roma
 *     zoomTo({ lat: 41.9, lng: 12.5 });
 * 
 *     // Reset allo stato iniziale
 *     resetZoom();
 * 
 *     // Chiamare quando l'utente interagisce (drag/scroll)
 *     <OrbitControls onStart={onUserInteract} />
 *   }
 */

import { useRef, useCallback } from "react";
import * as THREE from "three";

// ============================================================
// Tipi
// ============================================================

export interface GlobeZoomOptions {
  /** Distanza camera di default (zoom out) */
  defaultZoom?: number;
  /** Distanza camera quando si zooma su un punto */
  zoomedIn?: number;
  /** Velocità auto-rotazione in rad/s */
  rotationSpeed?: number;
  /** Fattore di interpolazione per la rotazione (0-1) */
  lerpFactor?: number;
  /** Fattore di interpolazione per lo zoom (0-1) */
  zoomLerpFactor?: number;
  /** Durata dell'animazione di reset in secondi */
  resetDuration?: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GlobeZoomController {
  /** Zooma verso una coordinata lat/lng */
  zoomTo: (target: LatLng) => void;
  /** Reset fluido allo stato iniziale con auto-rotazione */
  resetZoom: () => void;
  /** Da chiamare in useFrame() - applica rotazione e zoom al gruppo e alla camera */
  applyFrame: (
    groupRef: React.RefObject<THREE.Group>,
    camera: THREE.Camera,
    elapsedTime: number,
    delta: number
  ) => void;
  /** Da passare a OrbitControls onStart per tracciare l'interazione utente */
  onUserInteract: () => void;
  /** Stato corrente: true se l'utente sta interagendo */
  isUserInteracting: React.MutableRefObject<boolean>;
}

// ============================================================
// Funzioni di Easing
// ============================================================

/** Easing cubico in-out: accelera e decelera dolcemente */
export function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Easing quartico out: decelerazione pronunciata */
export function easeOutQuart(x: number): number {
  return 1 - Math.pow(1 - x, 4);
}

/** Easing sinusoidale in-out: molto morbido */
export function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

// ============================================================
// Helper: Coordinate -> Rotazione
// ============================================================

/**
 * Converte latitudine e longitudine in angoli di rotazione per il globo.
 * Il risultato è pronto per essere assegnato a group.rotation.x / .y
 */
export function latLngToRotation(lat: number, lng: number): { x: number; y: number } {
  return {
    x: THREE.MathUtils.degToRad(lat),
    y: THREE.MathUtils.degToRad(-(lng + 90)),
  };
}

// ============================================================
// Hook principale
// ============================================================

export function useGlobeZoom(options: GlobeZoomOptions = {}): GlobeZoomController {
  const {
    defaultZoom = 2.8,
    zoomedIn = 1.6,
    rotationSpeed = 0.08,
    lerpFactor = 0.03,
    zoomLerpFactor = 0.04,
    resetDuration = 1.5,
  } = options;

  // Stato interno
  const currentRotation = useRef({ x: 0, y: 0 });
  const targetRotation = useRef({ x: 0, y: 0 });
  const targetZoom = useRef(defaultZoom);
  const userInteracting = useRef(false);
  const isResetting = useRef(false);
  const hasTarget = useRef(false);

  // Reset animation state
  const resetStartTime = useRef(0);
  const resetStartZoom = useRef(defaultZoom);
  const resetStartRotation = useRef({ x: 0, y: 0 });

  /** Zooma verso una coordinata */
  const zoomTo = useCallback((target: LatLng) => {
    userInteracting.current = false;
    isResetting.current = false;
    hasTarget.current = true;

    const rot = latLngToRotation(target.lat, target.lng);
    targetRotation.current = rot;
    targetZoom.current = zoomedIn;
  }, [zoomedIn]);

  /** Reset fluido allo stato iniziale */
  const resetZoom = useCallback(() => {
    hasTarget.current = false;
    isResetting.current = true;
    resetStartTime.current = 0; // verrà impostato al primo frame
    resetStartRotation.current = { ...currentRotation.current };
    resetStartZoom.current = targetZoom.current;
    targetZoom.current = defaultZoom;
    targetRotation.current = { x: 0, y: 0 };
  }, [defaultZoom]);

  /** Callback per OrbitControls onStart */
  const onUserInteract = useCallback(() => {
    userInteracting.current = true;
  }, []);

  /** Da chiamare ogni frame in useFrame() */
  const applyFrame = useCallback((
    groupRef: React.RefObject<THREE.Group>,
    camera: THREE.Camera,
    elapsedTime: number,
    delta: number
  ) => {
    const group = groupRef.current;
    if (!group) return;

    // --- Reset cinematografico ---
    if (isResetting.current) {
      if (resetStartTime.current === 0) {
        resetStartTime.current = elapsedTime;
      }

      const elapsed = elapsedTime - resetStartTime.current;
      const progress = Math.min(elapsed / resetDuration, 1);
      const eased = easeInOutCubic(progress);

      // Rotazione: torna a neutro + riprendi auto-rotazione gradualmente
      currentRotation.current.x = resetStartRotation.current.x * (1 - eased);
      currentRotation.current.y = resetStartRotation.current.y + delta * rotationSpeed * eased;

      // Zoom: interpola verso defaultZoom
      const z = resetStartZoom.current + (defaultZoom - resetStartZoom.current) * eased;
      camera.position.z = z;

      if (progress >= 1) {
        isResetting.current = false;
        userInteracting.current = false;
        resetStartTime.current = 0;
      }
    }
    // --- Auto-rotazione (idle) ---
    else if (!hasTarget.current && !userInteracting.current) {
      currentRotation.current.y += delta * rotationSpeed;

      // Zoom fluido verso default
      const diff = defaultZoom - camera.position.z;
      camera.position.z += diff * zoomLerpFactor;
    }
    // --- Zoom verso target ---
    else if (hasTarget.current && !userInteracting.current) {
      // Rotazione smooth verso target
      currentRotation.current.x = THREE.MathUtils.lerp(
        currentRotation.current.x,
        targetRotation.current.x,
        lerpFactor
      );
      currentRotation.current.y = THREE.MathUtils.lerp(
        currentRotation.current.y,
        targetRotation.current.y,
        lerpFactor
      );

      // Zoom smooth
      const diff = targetZoom.current - camera.position.z;
      camera.position.z += diff * zoomLerpFactor;
    }

    // Applica rotazione al gruppo
    group.rotation.x = currentRotation.current.x;
    group.rotation.y = currentRotation.current.y;
  }, [defaultZoom, rotationSpeed, lerpFactor, zoomLerpFactor, resetDuration]);

  return {
    zoomTo,
    resetZoom,
    applyFrame,
    onUserInteract,
    isUserInteracting: userInteracting,
  };
}
