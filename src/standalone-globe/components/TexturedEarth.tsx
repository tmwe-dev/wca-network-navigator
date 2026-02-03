import { useRef, useMemo } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { Sphere } from "@react-three/drei";
import * as THREE from "three";

interface TexturedEarthProps {
  rotation: number;
}

export function TexturedEarth({ rotation }: TexturedEarthProps) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  // Load textures
  const [dayTexture, nightTexture, bumpTexture, specularTexture] = useLoader(
    THREE.TextureLoader,
    [
      '/textures/earth-day.jpg',
      '/textures/earth-night.jpg', 
      '/textures/earth-bump.png',
      '/textures/earth-specular.png',
    ]
  );

  // Configure textures
  useMemo(() => {
    [dayTexture, nightTexture, bumpTexture, specularTexture].forEach(texture => {
      if (texture) {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.SRGBColorSpace;
      }
    });
  }, [dayTexture, nightTexture, bumpTexture, specularTexture]);

  // Cloud rotation (slightly faster than earth)
  useFrame((_, delta) => {
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.01;
    }
  });

  // Custom shader - night only view with subtle lighting
  const earthMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        nightTexture: { value: nightTexture },
        bumpTexture: { value: bumpTexture },
        specularTexture: { value: specularTexture },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D nightTexture;
        uniform sampler2D bumpTexture;
        uniform sampler2D specularTexture;
        
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          // Sample night texture
          vec4 nightColor = texture2D(nightTexture, vUv);
          float specular = texture2D(specularTexture, vUv).r;
          
          // Use night texture with enhanced brightness
          vec4 baseColor = nightColor * 1.8;
          
          // Add subtle specular on water
          float specularHighlight = pow(max(dot(vNormal, normalize(cameraPosition - vPosition)), 0.0), 16.0);
          baseColor.rgb += specular * specularHighlight * 0.2;
          
          // Slight atmospheric tint at the edges
          float fresnel = pow(1.0 - abs(dot(vNormal, normalize(cameraPosition - vPosition))), 2.0);
          baseColor.rgb += vec3(0.2, 0.4, 0.8) * fresnel * 0.15;
          
          gl_FragColor = baseColor;
        }
      `,
    });
  }, [nightTexture, bumpTexture, specularTexture]);

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
      <Sphere args={[1.2, 64, 64]} material={atmosphereMaterial} />
      
      {/* Inner atmosphere rim */}
      <Sphere args={[1.02, 64, 64]} material={innerGlowMaterial} />

      {/* Main Earth with day/night shader */}
      <mesh ref={earthRef} rotation={[0, rotation, 0]}>
        <sphereGeometry args={[1, 128, 128]} />
        <primitive object={earthMaterial} attach="material" />
      </mesh>

      {/* Clouds layer - semi-transparent white with subtle texture */}
      <mesh ref={cloudsRef} rotation={[0, rotation, 0]}>
        <sphereGeometry args={[1.008, 64, 64]} />
        <meshPhongMaterial 
          color="#ffffff"
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

// Fallback simple Earth for when textures are loading
export function SimpleEarth() {
  return (
    <>
      {/* Earth base - deep ocean */}
      <Sphere args={[1, 128, 128]}>
        <meshPhongMaterial
          color="#0c1929"
          emissive="#0a1525"
          emissiveIntensity={0.1}
          shininess={25}
        />
      </Sphere>

      {/* Wireframe overlay */}
      <Sphere args={[1.003, 128, 128]}>
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
      <Sphere args={[1.006, 48, 48]}>
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
