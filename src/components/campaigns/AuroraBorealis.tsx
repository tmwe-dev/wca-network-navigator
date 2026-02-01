import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface AuroraProps {
  isNorth?: boolean;
}

function AuroraRing({ isNorth = true }: AuroraProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const time = useRef(0);

  // Create aurora geometry - a ring around the pole
  const geometry = useMemo(() => {
    const innerRadius = 0.15;
    const outerRadius = 0.45;
    const segments = 64;
    
    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, segments, 8);
    return geometry;
  }, []);

  // Custom shader material for aurora effect
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color("#22c55e") }, // Green
        uColor2: { value: new THREE.Color("#06b6d4") }, // Cyan
        uColor3: { value: new THREE.Color("#a855f7") }, // Purple
        uOpacity: { value: 0.6 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vPosition;
        uniform float uTime;
        
        void main() {
          vUv = uv;
          vPosition = position;
          
          // Add wave displacement
          vec3 pos = position;
          float wave = sin(uTime * 2.0 + position.x * 10.0) * 0.02;
          wave += sin(uTime * 1.5 + position.y * 8.0) * 0.015;
          pos.z += wave;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        uniform float uOpacity;
        
        varying vec2 vUv;
        varying vec3 vPosition;
        
        // Simplex noise function
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }
        
        float snoise(vec2 v) {
          const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                             -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy));
          vec2 x0 = v -   i + dot(i, C.xx);
          vec2 i1;
          i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz;
          x12.xy -= i1;
          i = mod289(i);
          vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
            + i.x + vec3(0.0, i1.x, 1.0 ));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
            dot(x12.zw,x12.zw)), 0.0);
          m = m*m;
          m = m*m;
          vec3 x = 2.0 * fract(p * C.www) - 1.0;
          vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5);
          vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
          vec3 g;
          g.x  = a0.x  * x0.x  + h.x  * x0.y;
          g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }
        
        void main() {
          // Distance from center for fade
          float dist = length(vPosition.xy);
          float innerFade = smoothstep(0.15, 0.25, dist);
          float outerFade = 1.0 - smoothstep(0.35, 0.45, dist);
          
          // Animated noise patterns
          float noise1 = snoise(vec2(vUv.x * 8.0 + uTime * 0.3, vUv.y * 4.0 + uTime * 0.1));
          float noise2 = snoise(vec2(vUv.x * 12.0 - uTime * 0.2, vUv.y * 6.0 + uTime * 0.15));
          float noise3 = snoise(vec2(vUv.x * 6.0 + uTime * 0.4, vUv.y * 3.0 - uTime * 0.1));
          
          // Combine noises
          float combinedNoise = (noise1 + noise2 * 0.5 + noise3 * 0.3) / 1.8;
          combinedNoise = combinedNoise * 0.5 + 0.5;
          
          // Curtain effect - vertical bands
          float curtain = sin(vUv.x * 30.0 + uTime * 2.0) * 0.5 + 0.5;
          curtain *= sin(vUv.x * 15.0 - uTime * 1.5) * 0.5 + 0.5;
          
          // Color mixing based on angle and noise
          float angle = atan(vPosition.y, vPosition.x) / 3.14159;
          float colorMix1 = sin(angle * 3.0 + uTime * 0.5) * 0.5 + 0.5;
          float colorMix2 = cos(angle * 5.0 - uTime * 0.3) * 0.5 + 0.5;
          
          vec3 color = mix(uColor1, uColor2, colorMix1);
          color = mix(color, uColor3, colorMix2 * 0.4);
          
          // Apply noise to color intensity
          color *= 0.7 + combinedNoise * 0.6;
          
          // Flickering effect
          float flicker = sin(uTime * 8.0 + vUv.x * 20.0) * 0.1 + 0.9;
          
          // Final opacity
          float alpha = innerFade * outerFade * curtain * combinedNoise * uOpacity * flicker;
          alpha = clamp(alpha, 0.0, 0.8);
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  useFrame((state, delta) => {
    time.current += delta;
    if (material.uniforms) {
      material.uniforms.uTime.value = time.current;
    }
    
    // Slow rotation
    if (groupRef.current) {
      groupRef.current.rotation.z += delta * 0.05;
    }
  });

  // Position at pole
  const yPosition = isNorth ? 0.85 : -0.85;
  const rotation: [number, number, number] = isNorth 
    ? [-Math.PI / 2.2, 0, 0] 
    : [Math.PI / 2.2, 0, 0];

  return (
    <group ref={groupRef} position={[0, yPosition, 0]} rotation={rotation}>
      <mesh ref={meshRef} geometry={geometry} material={material} />
    </group>
  );
}

// Particle system for aurora sparkles
function AuroraParticles({ isNorth = true }: AuroraProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const time = useRef(0);

  const { positions, colors } = useMemo(() => {
    const count = 200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    
    const colorPalette = [
      new THREE.Color("#22c55e"),
      new THREE.Color("#06b6d4"),
      new THREE.Color("#a855f7"),
      new THREE.Color("#10b981"),
    ];

    for (let i = 0; i < count; i++) {
      // Distribute around pole in a ring
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.2 + Math.random() * 0.25;
      const height = (isNorth ? 0.8 : -0.8) + (Math.random() - 0.5) * 0.15;
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    return { positions, colors };
  }, [isNorth]);

  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.015,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  useFrame((state, delta) => {
    time.current += delta;
    
    if (pointsRef.current) {
      // Rotate particles
      pointsRef.current.rotation.y += delta * 0.1;
      
      // Pulse size
      material.size = 0.012 + Math.sin(time.current * 2) * 0.005;
      material.opacity = 0.6 + Math.sin(time.current * 3) * 0.2;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
}

// Glowing light beams
function AuroraBeams({ isNorth = true }: AuroraProps) {
  const groupRef = useRef<THREE.Group>(null);
  const time = useRef(0);

  const beams = useMemo(() => {
    const count = 12;
    const beamData = [];
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      beamData.push({
        angle,
        height: 0.3 + Math.random() * 0.2,
        width: 0.02 + Math.random() * 0.02,
        color: i % 3 === 0 ? "#22c55e" : i % 3 === 1 ? "#06b6d4" : "#a855f7",
        speed: 0.5 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      });
    }
    
    return beamData;
  }, []);

  useFrame((state, delta) => {
    time.current += delta;
    
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.02;
    }
  });

  const yBase = isNorth ? 0.75 : -0.75;

  return (
    <group ref={groupRef}>
      {beams.map((beam, index) => {
        const x = Math.cos(beam.angle) * 0.25;
        const z = Math.sin(beam.angle) * 0.25;
        
        return (
          <mesh
            key={index}
            position={[x, yBase, z]}
            rotation={[isNorth ? -0.3 : 0.3, beam.angle, 0]}
          >
            <planeGeometry args={[beam.width, beam.height]} />
            <meshBasicMaterial
              color={beam.color}
              transparent
              opacity={0.4}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export function AuroraBorealis() {
  return (
    <group>
      {/* North Pole Aurora */}
      <AuroraRing isNorth={true} />
      <AuroraParticles isNorth={true} />
      <AuroraBeams isNorth={true} />
      
      {/* South Pole Aurora (Aurora Australis) */}
      <AuroraRing isNorth={false} />
      <AuroraParticles isNorth={false} />
      <AuroraBeams isNorth={false} />
    </group>
  );
}
