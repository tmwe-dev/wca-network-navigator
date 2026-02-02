import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Sphere } from "@react-three/drei";
import * as THREE from "three";

interface TexturedEarthProps {
  rotation: number;
}

// Procedural Earth - no external textures, lightweight
export function TexturedEarth({ rotation }: TexturedEarthProps) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  // Cloud rotation (slightly faster than earth)
  useFrame((_, delta) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.01;
    }
  });

  // Procedural Earth shader - generates continents without textures
  const earthMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: new THREE.Vector3(5, 3, 5).normalize() },
        time: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sunDirection;
        uniform float time;
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        
        // Simplex noise functions for procedural continents
        vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
        vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        
        float snoise(vec3 v) {
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          
          vec3 x1 = x0 - i1 + C.xxx;
          vec3 x2 = x0 - i2 + C.yyy;
          vec3 x3 = x0 - D.yyy;
          
          i = mod289(i);
          vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
            
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          
          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          
          vec4 s0 = floor(b0) * 2.0 + 1.0;
          vec4 s1 = floor(b1) * 2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          
          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
          
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          
          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;
          
          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
        }
        
        float fbm(vec3 p) {
          float value = 0.0;
          float amplitude = 0.5;
          float frequency = 1.0;
          for (int i = 0; i < 4; i++) {
            value += amplitude * snoise(p * frequency);
            amplitude *= 0.5;
            frequency *= 2.0;
          }
          return value;
        }
        
        void main() {
          // Generate procedural continents using noise
          vec3 pos = vPosition * 2.5;
          float noise = fbm(pos);
          float continentMask = smoothstep(-0.1, 0.15, noise);
          
          // Colors
          vec3 oceanDeep = vec3(0.02, 0.06, 0.15);
          vec3 oceanShallow = vec3(0.05, 0.15, 0.35);
          vec3 landLow = vec3(0.08, 0.25, 0.12);
          vec3 landHigh = vec3(0.15, 0.35, 0.18);
          vec3 ice = vec3(0.85, 0.9, 0.95);
          
          // Ice caps
          float iceMask = smoothstep(0.85, 0.95, abs(vPosition.y));
          
          // Blend ocean depths
          float oceanDepth = fbm(pos * 3.0) * 0.5 + 0.5;
          vec3 oceanColor = mix(oceanDeep, oceanShallow, oceanDepth * 0.3);
          
          // Blend land heights
          float landHeight = fbm(pos * 4.0) * 0.5 + 0.5;
          vec3 landColor = mix(landLow, landHigh, landHeight);
          
          // Final base color
          vec3 baseColor = mix(oceanColor, landColor, continentMask);
          baseColor = mix(baseColor, ice, iceMask);
          
          // Calculate lighting
          float intensity = dot(vNormal, sunDirection);
          float dayNightMix = smoothstep(-0.2, 0.3, intensity);
          
          // Night side with city lights effect
          vec3 nightColor = baseColor * 0.05;
          float cityNoise = snoise(pos * 15.0);
          float cityLights = smoothstep(0.6, 0.8, cityNoise) * continentMask * (1.0 - iceMask);
          nightColor += vec3(1.0, 0.8, 0.4) * cityLights * 0.3;
          
          // Blend day and night
          vec3 finalColor = mix(nightColor, baseColor, dayNightMix);
          
          // Add specular on water
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float specular = pow(max(dot(reflect(-sunDirection, vNormal), viewDir), 0.0), 32.0);
          finalColor += specular * (1.0 - continentMask) * dayNightMix * 0.4;
          
          // Atmospheric fresnel
          float fresnel = pow(1.0 - abs(dot(vNormal, viewDir)), 2.0);
          finalColor += vec3(0.2, 0.4, 0.8) * fresnel * 0.12;
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });
  }, []);

  // Atmosphere shader - beautiful blue glow
  const atmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
          vec3 atmosphere = vec3(0.3, 0.6, 1.0);
          gl_FragColor = vec4(atmosphere, 1.0) * intensity * 1.2;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  // Inner glow
  const innerGlowMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.75 - dot(vNormal, vec3(0, 0, 1.0)), 3.0);
          vec3 glow = vec3(0.15, 0.5, 1.0);
          gl_FragColor = vec4(glow, intensity * 0.4);
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  return (
    <>
      {/* Outer atmosphere glow */}
      <Sphere args={[1.15, 64, 64]} material={atmosphereMaterial} />
      
      {/* Inner atmosphere rim */}
      <Sphere args={[1.02, 64, 64]} material={innerGlowMaterial} />

      {/* Main Earth with procedural shader */}
      <mesh ref={earthRef} rotation={[0, rotation, 0]}>
        <sphereGeometry args={[1, 96, 96]} />
        <primitive object={earthMaterial} attach="material" />
      </mesh>

      {/* Clouds layer - semi-transparent */}
      <mesh ref={cloudsRef} rotation={[0, rotation, 0]}>
        <sphereGeometry args={[1.008, 48, 48]} />
        <meshPhongMaterial 
          color="#ffffff"
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

// Fallback simple Earth for loading state
export function SimpleEarth() {
  return (
    <>
      {/* Earth base - deep ocean */}
      <Sphere args={[1, 64, 64]}>
        <meshPhongMaterial
          color="#0c1929"
          emissive="#0a1525"
          emissiveIntensity={0.1}
          shininess={25}
        />
      </Sphere>

      {/* Wireframe overlay */}
      <Sphere args={[1.003, 64, 64]}>
        <meshPhongMaterial
          color="#1a365d"
          emissive="#1e3a5f"
          emissiveIntensity={0.15}
          transparent
          opacity={0.9}
          wireframe
        />
      </Sphere>

      {/* Grid overlay */}
      <Sphere args={[1.006, 32, 32]}>
        <meshBasicMaterial
          color="#3b82f6"
          transparent
          opacity={0.08}
          wireframe
        />
      </Sphere>
    </>
  );
}
