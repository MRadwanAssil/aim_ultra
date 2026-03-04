import { Canvas } from "@react-three/fiber";
import { PointerLockControls, Sky } from "@react-three/drei";
import { useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, update, get, push, onValue } from "firebase/database";
import "./App.css";

type positionType = | number | THREE.Vector3 | [x: number, y: number, z: number]
| readonly [x: number, y: number, z: number] | Readonly<THREE.Vector3> | undefined;

function DrawCircles({ circlesList, handleCirclesClick }: { circlesList: boolean[]; handleCirclesClick: (index: number) => void }) {
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
        const position: positionType = [(col - COL_OFFSET) * SPACING, (row - 2 - ROW_OFFSET) * SPACING, Z_POSITION];  

        return (  
              <mesh receiveShadow key={i} position={position} onClick={() => handleCirclesClick(i)}>  
                    <sphereGeometry args={[SPHERE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />  
                    <meshStandardMaterial color="red" />  
              </mesh>  
        );  
  });

}

const createCheckerTexture = () => {
const GRID_SIZE: number = 1;
const CANVAS_SIZE: number = 1;
const CHECKER_COLORS: string[] = ["#909090", "#AAAAAA"];
const CHECKER_REPEAT: number = 1;

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

function GameArea({ setShoots }: { setShoots: React.Dispatch<React.SetStateAction<number>> }) {
const PLANE_POSITION_Y: number = -1;
const CAMERA_FOV: number = 75;
const CAMERA_POSITION: positionType = [0, -0.5, 5];

const [circlesList, setCirclesList] = useState(() => {  
        const arr = Array.from({ length: 32 }).map(() => false);  
        const indices = new Set();  
        while (indices.size < 5) { indices.add(Math.floor(Math.random() * 32)); }  
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
        <div className="game-area">  
         <Canvas shadows gl={{ antialias: true }} camera={{ fov: CAMERA_FOV, far: 4, position: CAMERA_POSITION }}>  
                    <Sky distance={450000} sunPosition={[100, 20, 100]} />  

                    
                    <PointerLockControls />  

                    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, PLANE_POSITION_Y, 0]}>  
                          <planeGeometry args={[50, 50, 1, 1]} />  
                          <meshStandardMaterial map={checkerTexture} roughness={0.95} metalness={0.05} />  
                    </mesh>  

                    <DrawCircles circlesList={circlesList} handleCirclesClick={handleCirclesClick} />  
              </Canvas>  

              <div className="crosshair">  
                  <span className="left"/>  
                  <span className="right"/>  
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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

type Player = {
name: string;
score: number;
};

export default function App() {
const [name, setName] = useState<string | null>(null);
const [inputName, setInputName] = useState("");
const [shoots, setShoots] = useState(0);
const [isPlaying, setIsPlaying] = useState(false);
const [timeLeft, setTimeLeft] = useState(30);

const [players, setPlayers] = useState<any[]>([]);  
  const [loading, setLoading] = useState(true);  

  useEffect(() => {  
        const savedName = localStorage.getItem("playerName");  
        if (savedName) setName(savedName);  
  }, []);  

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

  const saveScoreToFirebase = async (playerName: string, score: number) => {  
      try {  
          const playersRef = ref(db, "players");  
          const snapshot = await get(playersRef);  
    
          let existingKey: string | null = null;  
          let existingScore = 0;  
    
          snapshot.forEach((child) => {  
              if (child.val().name === playerName) {  
                  existingKey = child.key;  
                  existingScore = child.val().score || 0;  
              }  
          });  
    
          if (existingKey) {  
              if (score > existingScore) {  
                  await update(ref(db, `players/${existingKey}`), {  
                      score  
                  });  
              }  
          }   

          else {  
              await push(playersRef, { name: playerName, score });  
          }  
    
          loadScoreboard();  
      } catch (err) {  
          alert(`Firebase save error: ${err}`);  
      }  
  };  
    
  function loadScoreboard() {  
        const playersRef = ref(db, "players");  

        setLoading(true);  

        return onValue(playersRef, (snapshot) => {  
              const data = snapshot.val();  

              if (data) {  
                    const list = Object.values(data as Record<string, Player>).sort(  
                        (a, b) => b.score - a.score  
                    );  
                    setPlayers(list);  
              } else {  
                    setPlayers([]);  
              }  

              setLoading(false);  
        });  

  }  

  useEffect(() => { if (timeLeft === 0 && name) { saveScoreToFirebase(name, shoots); }}, [timeLeft]);  
  useEffect(() => loadScoreboard(), []);  

  const startGame = () => {  
        setLoading(false);  
        setShoots(0);  
        setTimeLeft(30);  
        setIsPlaying(true);  
  };  

  const saveName = () => {  
        if (!inputName.trim()) return;  
        localStorage.setItem("playerName", inputName);  
        setName(inputName);  
  };  

  if (!name) {  
        return (  
              <div className="username-container">  
                    <h2 className="username-title">Username</h2>  
                    <input  
                          className="username-input"  
                          placeholder="username"  
                          value={inputName}  
                          onChange={(e) => setInputName(e.target.value)}  
                    />  
                    <br />  
                    <button  
                          className="username-button"  
                          onClick={saveName}  
                          style={{ marginTop: "10px" }}  
                    >  
                          Done  
                    </button>  
              </div>  
        );  
  }  
    
  return (  
        <div className="main-container">  
              {!isPlaying && timeLeft === 30 && (  
                    <div className="menu-container">  
                          <button className="start-button" onClick={startGame}>  
                                Start Game  
                          </button>  
    
                          <h2 className="scoreboard-title">Scoreboard</h2>  
    
                          {loading ? (  
                                <p className="loading-text">Loading...</p>  
                          ) : (  
                                <ul className="scoreboard-list">  
                                      {players.map((p, index) => (  
                                            <li key={index} className="scoreboard-item">  
                                                  {index + 1}. {p.name} - {p.score}  
                                            </li>  
                                      ))}  
                                </ul>  
                          )}  
                    </div>  
              )}  
    
              {isPlaying && (  
                    <>  
                          <div className="hud-container" style={{ position: "absolute" }}>  
                                <h2 className="timer-text">Timer: {timeLeft}</h2>  
                                <h3 className="score-text">Score: {shoots}</h3>  
                          </div>  
    
                          <GameArea setShoots={setShoots} />  
                    </>  
              )}  
    
              {!isPlaying && timeLeft === 0 && (  
                    <div className="gameover-container">  
                          <h1 className="gameover-title">Game Over</h1>  
                          <h2 className="final-score">Score: {shoots}</h2>  
    
                          <button className="restart-button" onClick={startGame}>  
                                Play Again  
                          </button>  
    
                          {loading ? (  
                                <p className="loading-text">Loading...</p>  
                          ) : (  
                                <ul className="scoreboard-list">  
                                      {players.map((p, index) => (  
                                            <li key={index} className="scoreboard-item">  
                                                  {index + 1}. {p.name} - {p.score}  
                                            </li>  
                                      ))}  
                                </ul>  
                          )}  
                    </div>  
              )}  
        </div>  
  );

}