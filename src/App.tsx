import { Canvas } from "@react-three/fiber";
import { PointerLockControls, Sky } from "@react-three/drei";
import { useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, onValue } from "firebase/database";

type positionType =
      | number
      | THREE.Vector3
      | [x: number, y: number, z: number]
      | readonly [x: number, y: number, z: number]
      | Readonly<THREE.Vector3>
      | undefined;

function DrawCircles({
      circlesList,
      handleCirclesClick,
}: {
      circlesList: boolean[];
      handleCirclesClick: (index: number) => void;
}) {
      const GRID_SIZE: number = 8;
      const COL_OFFSET: number = 3.5;
      const ROW_OFFSET: number = 1.5;
      const SPACING: number = 0.2;
      const Z_POSITION: number = 3;
      const SPHERE_RADIUS: number = 0.08;
      const SPHERE_SEGMENTS: number = 32;

      return circlesList.map((isShown: boolean, i: number) => {
            if (!isShown) return null;

            const row = Math.floor(i / GRID_SIZE);
            const col = i % GRID_SIZE;
            const position: positionType = [
                  (col - COL_OFFSET) * SPACING,
                  (row - 2 - ROW_OFFSET) * SPACING,
                  Z_POSITION,
            ];

            return (
                  <mesh
                        castShadow
                        receiveShadow
                        key={i}
                        position={position}
                        onClick={() => handleCirclesClick(i)}
                  >
                        <sphereGeometry
                              args={[
                                    SPHERE_RADIUS,
                                    SPHERE_SEGMENTS,
                                    SPHERE_SEGMENTS,
                              ]}
                        />
                        <meshStandardMaterial color="red" />
                  </mesh>
            );
      });
}

const createCheckerTexture = () => {
      const GRID_SIZE: number = 8;
      const CANVAS_SIZE: number = 512;
      const CHECKER_COLORS: string[] = ["#909090", "#AAAAAA"];
      const CHECKER_REPEAT: number = 25;

      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;

      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      const tile = CANVAS_SIZE / GRID_SIZE;

      for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
                  ctx.fillStyle = CHECKER_COLORS[(x + y) % 2];
                  ctx.fillRect(x * tile, y * tile, tile, tile);
            }
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(CHECKER_REPEAT, CHECKER_REPEAT);

      return texture;
};

function GameArea({
      setShoots,
}: {
      setShoots: React.Dispatch<React.SetStateAction<number>>;
}) {
      const PLANE_POSITION_Y: number = -1;
      const CAMERA_FOV: number = 75;
      const CAMERA_POSITION: positionType = [0, -0.5, 5];

      const [circlesList, setCirclesList] = useState(() => {
            const arr = Array.from({ length: 32 }).map(() => false);
            const indices = new Set();
            while (indices.size < 5) {
                  indices.add(Math.floor(Math.random() * 32));
            }
            indices.forEach((i) => (arr[i as number] = true));
            return arr;
      });

      const handleCirclesClick = (i: number) => {
            setShoots((prev) => prev + 3);

            let randomNewPosition = i;

            while (randomNewPosition === i || circlesList[randomNewPosition]) {
                  randomNewPosition = Math.floor(Math.random() * 32);
            }

            setCirclesList((prev) =>
                  prev.map((v, index) => {
                        if (index === i) return false;
                        if (index === randomNewPosition) return true;
                        return v;
                  }),
            );
      };

      const checkerTexture = useMemo(() => createCheckerTexture(), []);

      return (
            <div
                  style={{
                        width: "100vw",
                        height: "100vh",
                        position: "relative",
                  }}
            >
                  <Canvas
                        shadows
                        gl={{ antialias: true }}
                        camera={{ fov: CAMERA_FOV, position: CAMERA_POSITION }}
                  >
                        <Sky distance={450000} sunPosition={[100, 20, 100]} />

                        <directionalLight
                              position={[100, 20, 100]}
                              intensity={1}
                        />

                        <directionalLight
                              position={[50, 100, 50]}
                              intensity={2}
                              castShadow
                        />

                        <directionalLight
                              position={[80, 160, 40]}
                              intensity={2.2}
                              castShadow
                        />

                        <hemisphereLight intensity={0.35} />

                        <PointerLockControls />

                        <mesh
                              receiveShadow
                              rotation={[-Math.PI / 2, 0, 0]}
                              position={[0, PLANE_POSITION_Y, 0]}
                        >
                              <planeGeometry args={[50, 50, 1, 1]} />
                              <meshStandardMaterial
                                    map={checkerTexture}
                                    roughness={0.95}
                                    metalness={0.05}
                              />
                        </mesh>

                        <DrawCircles
                              circlesList={circlesList}
                              handleCirclesClick={handleCirclesClick}
                        />
                  </Canvas>

                  <div
                        style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              width: 22,
                              height: 22,
                              pointerEvents: "none",
                              mixBlendMode: "difference",
                        }}
                  >
                        <div
                              style={{
                                    position: "absolute",
                                    top: 0,
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    width: 2,
                                    height: 8,
                                    background: "white",
                              }}
                        />
                        <div
                              style={{
                                    position: "absolute",
                                    bottom: 0,
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    width: 2,
                                    height: 8,
                                    background: "white",
                              }}
                        />
                        <div
                              style={{
                                    position: "absolute",
                                    left: 0,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: 8,
                                    height: 2,
                                    background: "white",
                              }}
                        />
                        <div
                              style={{
                                    position: "absolute",
                                    right: 0,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    width: 8,
                                    height: 2,
                                    background: "white",
                              }}
                        />
                  </div>
            </div>
      );
}

const firebaseConfig = {
      apiKey: "AIzaSyCzssrIcOlHwRCsRSVq83mucCl6spOD_Bw",
      authDomain: "aimaim-6ea09.firebaseapp.com",
      databaseURL: "https://aimaim-6ea09-default-rtdb.firebaseio.com",
      projectId: "aimaim-6ea09",
      storageBucket: "aimaim-6ea09.firebasestorage.app",
      messagingSenderId: "841086788751",
      appId: "1:841086788751:web:0be70dc204f492f4f7bcfa",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default function App() {
      const [name, setName] = useState<string | null>(null);
      const [inputName, setInputName] = useState("");
      const [shoots, setShoots] = useState(0);
      const [isPlaying, setIsPlaying] = useState(false);
      const [timeLeft, setTimeLeft] = useState(60);

      const [players, setPlayers] = useState<any[]>([]);
      const [loading, setLoading] = useState(true);

      // LocalStorage kontrolü
      useEffect(() => {
            const savedName = localStorage.getItem("playerName");
            if (savedName) setName(savedName);
      }, []);

      // Timer
      useEffect(() => {
            let timer: number | undefined;

            if (isPlaying && timeLeft > 0) {
                  timer = window.setInterval(() => {
                        setTimeLeft((prev) => prev - 1);
                  }, 1000);
            }

            if (timeLeft === 0) {
                  setIsPlaying(false);
            }

            return () => {
                  if (timer) clearInterval(timer);
            };
      }, [isPlaying, timeLeft]);

      // Score Firebase'e kaydet
      const saveScoreToFirebase = async (playerName: string, score: number) => {
            const playersRef = ref(db, "players");

            await push(playersRef, {
                  name: playerName,
                  score: score,
                  createdAt: Date.now(),
            });
      };

      // Oyun bitince kaydet
      useEffect(() => {
            if (timeLeft === 0 && name) {
                  saveScoreToFirebase(name, shoots);
            }
      }, [timeLeft]);

      // Leaderboard çek
      useEffect(() => {
            const playersRef = ref(db, "players");

            setLoading(true);

            const unsubscribe = onValue(playersRef, (snapshot) => {
                  const data = snapshot.val();

                  if (data) {
                        const list = Object.values(data).sort(
                              (a: any, b: any) => b.score - a.score,
                        );
                        setPlayers(list);
                  } else {
                        setPlayers([]);
                  }

                  setLoading(false);
            });

            return () => unsubscribe();
      }, []);

      const startGame = () => {
            setShoots(0);
            setTimeLeft(60);
            setIsPlaying(true);
      };

      const saveName = () => {
            if (!inputName.trim()) return;
            localStorage.setItem("playerName", inputName);
            setName(inputName);
      };

      // İsim ekranı
      if (!name) {
            return (
                  <div style={{ textAlign: "center", marginTop: "50px" }}>
                        <h2>Enter Your Name</h2>
                        <input
                              value={inputName}
                              onChange={(e) => setInputName(e.target.value)}
                        />
                        <button onClick={saveName}>Save</button>
                  </div>
            );
      }

      return (
            <div style={{ textAlign: "center", marginTop: "50px" }}>
                  <h3>Player: {name}</h3>

                  {!isPlaying && timeLeft === 60 && (
                        <>
                              <button onClick={startGame}>Start Game</button>

                              <h2>Leaderboard</h2>

                              {loading ? (
                                    <p>Loading...</p>
                              ) : (
                                    <ul
                                          style={{
                                                listStyle: "none",
                                                padding: 0,
                                          }}
                                    >
                                          {players
                                                .slice(0, 10)
                                                .map((p, index) => (
                                                      <li key={index}>
                                                            {index + 1}.{" "}
                                                            {p.name} - {p.score}
                                                      </li>
                                                ))}
                                    </ul>
                              )}
                        </>
                  )}

                  {isPlaying && (
                        <>
                              <h2>Time: {timeLeft}</h2>
                              <h3>Score: {shoots}</h3>
                              <GameArea setShoots={setShoots} />
                        </>
                  )}

                  {!isPlaying && timeLeft === 0 && (
                        <>
                              <h1>Game Over</h1>
                              <h2>Your Score: {shoots}</h2>
                              <button onClick={startGame}>Play Again</button>
                        </>
                  )}
            </div>
      );
}
