'use client'

import { useRef, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Float } from '@react-three/drei'
import * as THREE from 'three'

// Body region definitions with associated symptoms
const BODY_REGIONS: Record<string, {
  position: [number, number, number]
  scale: [number, number, number]
  color: string
  symptoms: string[]
  label: string
}> = {
  head: {
    position: [0, 3.2, 0],
    scale: [0.65, 0.75, 0.65],
    color: '#818cf8',
    symptoms: ['headache', 'dizziness', 'blurred_and_distorted_vision', 'loss_of_smell', 'slurred_speech', 'altered_sensorium'],
    label: 'Head',
  },
  throat: {
    position: [0, 2.3, 0],
    scale: [0.45, 0.35, 0.45],
    color: '#f472b6',
    symptoms: ['patches_in_throat', 'throat_irritation', 'cough', 'phlegm', 'continuous_sneezing', 'runny_nose', 'congestion', 'sinus_pressure'],
    label: 'Throat',
  },
  chest: {
    position: [0, 1.4, 0],
    scale: [0.85, 0.7, 0.5],
    color: '#34d399',
    symptoms: ['chest_pain', 'breathlessness', 'fast_heart_rate', 'palpitations', 'blood_in_sputum', 'mucoid_sputum', 'rusty_sputum'],
    label: 'Chest',
  },
  abdomen: {
    position: [0, 0.4, 0],
    scale: [0.75, 0.6, 0.45],
    color: '#fbbf24',
    symptoms: ['stomach_pain', 'acidity', 'vomiting', 'nausea', 'indigestion', 'abdominal_pain', 'belly_pain', 'loss_of_appetite', 'swelling_of_stomach', 'distention_of_abdomen', 'stomach_bleeding'],
    label: 'Abdomen',
  },
  pelvis: {
    position: [0, -0.4, 0],
    scale: [0.8, 0.45, 0.45],
    color: '#f97316',
    symptoms: ['burning_micturition', 'spotting_urination', 'bladder_discomfort', 'foul_smell_of_urine', 'continuous_feel_of_urine', 'dark_urine', 'yellow_urine', 'passage_of_gases', 'pain_in_anal_region', 'bloody_stool', 'constipation', 'diarrhoea', 'pain_during_bowel_movements', 'irritation_in_anus'],
    label: 'Pelvis',
  },
  left_arm: {
    position: [-1.2, 1.2, 0],
    scale: [0.3, 1.1, 0.3],
    color: '#a78bfa',
    symptoms: ['joint_pain', 'muscle_weakness', 'muscle_wasting', 'muscle_pain', 'swelling_joints', 'weakness_of_one_body_side', 'weakness_in_limbs'],
    label: 'Left Arm',
  },
  right_arm: {
    position: [1.2, 1.2, 0],
    scale: [0.3, 1.1, 0.3],
    color: '#a78bfa',
    symptoms: ['joint_pain', 'muscle_weakness', 'muscle_wasting', 'muscle_pain', 'swelling_joints', 'weakness_of_one_body_side', 'weakness_in_limbs'],
    label: 'Right Arm',
  },
  left_leg: {
    position: [-0.35, -1.8, 0],
    scale: [0.32, 1.3, 0.32],
    color: '#06b6d4',
    symptoms: ['knee_pain', 'hip_joint_pain', 'swollen_legs', 'painful_walking', 'movement_stiffness', 'cramps', 'swollen_blood_vessels', 'prominent_veins_on_calf'],
    label: 'Left Leg',
  },
  right_leg: {
    position: [0.35, -1.8, 0],
    scale: [0.32, 1.3, 0.32],
    color: '#06b6d4',
    symptoms: ['knee_pain', 'hip_joint_pain', 'swollen_legs', 'painful_walking', 'movement_stiffness', 'cramps', 'swollen_blood_vessels', 'prominent_veins_on_calf'],
    label: 'Right Leg',
  },
  skin: {
    position: [1.8, 3.0, 0],
    scale: [0.5, 0.5, 0.1],
    color: '#ec4899',
    symptoms: ['itching', 'skin_rash', 'nodal_skin_eruptions', 'yellowish_skin', 'skin_peeling', 'pus_filled_pimples', 'blackheads', 'dischromic_patches', 'red_spots_over_body', 'silver_like_dusting', 'blister', 'red_sore_around_nose', 'yellow_crust_ooze', 'scurring', 'small_dents_in_nails', 'inflammatory_nails', 'brittle_nails'],
    label: 'Skin',
  },
}

interface BodyPartProps {
  regionKey: string
  region: typeof BODY_REGIONS[string]
  isSelected: boolean
  isHighlighted: boolean
  onClick: () => void
  onHover: (hovering: boolean) => void
}

function BodyPart({ regionKey, region, isSelected, isHighlighted, onClick, onHover }: BodyPartProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  const color = useMemo(() => new THREE.Color(region.color), [region.color])
  const emissiveIntensity = isSelected ? 0.6 : hovered || isHighlighted ? 0.35 : 0.08

  useFrame((_, delta) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, emissiveIntensity, delta * 8)
      const targetScale = hovered || isSelected ? 1.08 : 1
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 8)
    }
  })

  return (
    <group position={region.position}>
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick() }}
        onPointerEnter={(e) => { e.stopPropagation(); setHovered(true); onHover(true); document.body.style.cursor = 'pointer' }}
        onPointerLeave={() => { setHovered(false); onHover(false); document.body.style.cursor = 'auto' }}
      >
        {regionKey === 'head' ? (
          <sphereGeometry args={[region.scale[0], 24, 24]} />
        ) : regionKey === 'skin' ? (
          <boxGeometry args={region.scale} />
        ) : (
          <capsuleGeometry args={[region.scale[0], region.scale[1], 8, 16]} />
        )}
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isSelected ? 0.95 : hovered ? 0.85 : 0.5}
          emissive={color}
          emissiveIntensity={0.08}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>
      {/* Always show label, pull it further forward along Z-axis */}
      <Text
        position={[0, region.scale[1] * 0.8 + 0.4, 0.8]}
        fontSize={0.22}
        color={isSelected ? '#ffffff' : hovered ? '#e2e8f0' : '#94a3b8'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
        depthOffset={-10} // Ensure it renders on top
      >
        {region.label}
      </Text>
    </group>
  )
}

function HumanBodyScene({ selectedRegion, highlightedRegions, onSelectRegion }: {
  selectedRegion: string | null
  highlightedRegions: string[]
  onSelectRegion: (region: string) => void
}) {
  const groupRef = useRef<THREE.Group>(null)

  // No auto-rotation so labels stay readable
  // User can drag to rotate manually via OrbitControls

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={1} color="#818cf8" />
      <pointLight position={[-5, 3, -5]} intensity={0.6} color="#34d399" />
      <spotLight position={[0, 8, 4]} angle={0.3} penumbra={1} intensity={0.8} castShadow />

      <group ref={groupRef}>
        {Object.entries(BODY_REGIONS).map(([key, region]) => (
          <BodyPart
            key={key}
            regionKey={key}
            region={region}
            isSelected={selectedRegion === key}
            isHighlighted={highlightedRegions.includes(key)}
            onClick={() => onSelectRegion(key)}
            onHover={() => {}}
          />
        ))}

        {/* Central spine line for visual effect */}
        <mesh position={[0, 0.8, -0.2]}>
          <cylinderGeometry args={[0.04, 0.04, 5, 8]} />
          <meshStandardMaterial color="#334155" transparent opacity={0.3} />
        </mesh>
      </group>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={4}
        maxDistance={12}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 1.2}
      />

      {/* Grid floor */}
      <gridHelper args={[20, 20, '#1e293b', '#0f172a']} position={[0, -3.5, 0]} />
    </>
  )
}

interface HumanBody3DProps {
  onSymptomsSelected: (symptoms: string[]) => void
  selectedSymptoms: string[]
}

export default function HumanBody3D({ onSymptomsSelected, selectedSymptoms }: HumanBody3DProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  // Determine which regions are highlighted based on selected symptoms
  const highlightedRegions = useMemo(() => {
    const regions: string[] = []
    Object.entries(BODY_REGIONS).forEach(([key, region]) => {
      if (region.symptoms.some(s => selectedSymptoms.includes(s))) {
        regions.push(key)
      }
    })
    return regions
  }, [selectedSymptoms])

  const handleSelectRegion = (region: string) => {
    setSelectedRegion(region === selectedRegion ? null : region)
  }

  const handleAddSymptom = (symptom: string) => {
    if (!selectedSymptoms.includes(symptom)) {
      onSymptomsSelected([...selectedSymptoms, symptom])
    }
  }

  const selectedRegionData = selectedRegion ? BODY_REGIONS[selectedRegion] : null

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* 3D Canvas */}
      <div className="relative w-full lg:w-2/3 h-[500px] bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
        <Canvas
          camera={{ position: [0, 1, 7], fov: 45 }}
          style={{ background: 'transparent' }}
        >
          <HumanBodyScene
            selectedRegion={selectedRegion}
            highlightedRegions={highlightedRegions}
            onSelectRegion={handleSelectRegion}
          />
        </Canvas>
        
        {/* Overlay instructions */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none">
          <div className="text-xs text-slate-500 bg-slate-900/80 px-3 py-2 rounded-lg backdrop-blur-sm">
            🖱️ Click body part to see symptoms • Drag to rotate • Scroll to zoom
          </div>
        </div>
      </div>

      {/* Symptom Panel */}
      <div className="w-full lg:w-1/3">
        {selectedRegionData ? (
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 animate-fadeIn">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: selectedRegionData.color }}
              />
              <h3 className="text-lg font-bold text-white">{selectedRegionData.label} Symptoms</h3>
            </div>
            <div className="space-y-2 max-h-[380px] overflow-y-auto">
              {selectedRegionData.symptoms.map(symptom => {
                const isActive = selectedSymptoms.includes(symptom)
                return (
                  <button
                    key={symptom}
                    onClick={() => handleAddSymptom(symptom)}
                    disabled={isActive}
                    className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all ${
                      isActive
                        ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 cursor-default'
                        : 'bg-slate-800/50 text-slate-300 border border-transparent hover:border-white/10 hover:bg-slate-800 cursor-pointer'
                    }`}
                  >
                    <span className="capitalize">{symptom.replace(/_/g, ' ')}</span>
                    {isActive && <span className="text-teal-400 ml-2">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-8 h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-3xl">🧬</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Click a Body Part</h3>
            <p className="text-sm text-slate-500">
              Click on the glowing body regions in the 3D model to see associated symptoms and add them to your analysis.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
