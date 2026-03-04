import { Canvas } from "@react-three/fiber";
import { PointerLockControls, Sky } from "@react-three/drei";
import { useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, update, get, push, onValue } from "firebase/database";
import "./App.css";

type positionType =
  | number
  | THREE.Vector3
  | [x: number, y: number, z: number]
  | readonly [x: number, y: number, z: number]
  | Readonly<THREE.Vector3>
  | undefined;

type Player = {
  name: string;
  score: number;
};

type GameSettings = {
  shadows: boolean;
  textureRepeat: number;
  cameraFar: number;
};

/* ================= SETTINGS DEFAULT ================= */

const defaultSettings: GameSettings = {
  shadows: true,
  textureRepeat: 25,
  cameraFar: 4,
};

/* ================= CHECKER TEXTURE ================= */

const createCheckerTexture = (repeatValue: number) => {
  const GRID_SIZE = 8;
  const CANVAS_SIZE = 512;
  const CHECKER_COLORS = ["#909090", "#AAAAAA"];

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
  texture.repeat.set(repeatValue, repeatValue);

  return texture;
};

/* ================= DRAW CIRCLES ================= */

function DrawCircles({
  circlesList,
  handleCirclesClick,
  shadows,
}: {
  circlesList: boolean[];
  handleCirclesClick: (index: number) => void;
  shadows: boolean;
}) {
  const GRID_SIZE = 8;
  const COL_OFFSET = 3.5;
  const ROW_OFFSET = 1.5;
  const SPACING = 0.2;
  const Z_POSITION = 3;
  const SPHERE_RADIUS = 0.08;
  const SPHERE_SEGMENTS = 32;

  return circlesList.map((isShown, i) => {
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
        
        receiveShadow={shadows}
        key={i}
        position={position}
        onClick={() => handleCirclesClick(i)}
      >
        <sphereGeometry args={[SPHERE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS]} />
        <meshStandardMaterial color="red" />
      </mesh>
    );
  });
}

/* ================= GAME AREA ================= */

function GameArea({
  setShoots,
  settings,
}: {
  setShoots: React.Dispatch<React.SetStateAction<number>>;
  settings: GameSettings;
}) {
  const PLANE_POSITION_Y = -1;
  const CAMERA_FOV = 75;
  const CAMERA_POSITION: positionType = [0, -0.5, 5];

  const [circlesList, setCirclesList] = useState(() => {
    const arr = Array.from({ length: 32 }).map(() => false);
    const indices = new Set<number>();
    while (indices.size < 5) indices.add(Math.floor(Math.random() * 32));
    indices.forEach((i) => (arr[i] = true));
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
      })
    );
  };

  const checkerTexture = useMemo(
    () => createCheckerTexture(settings.textureRepeat),
    [settings.textureRepeat]
  );

  return (
    <div className="game-area">
      <Canvas
        shadows={settings.shadows}
        gl={{ antialias: true }}
        camera={{
          fov: CAMERA_FOV,
          far: settings.cameraFar,
          position: CAMERA_POSITION,
        }}
      >
        <Sky distance={450000} sunPosition={[100, 20, 100]} />

        <PointerLockControls />

        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, PLANE_POSITION_Y, 0]}
        >
          <planeGeometry args={[50, 50]} />
          <meshStandardMaterial
            map={checkerTexture || undefined}
            roughness={0.95}
            metalness={0.05}
          />
        </mesh>

        <DrawCircles
          circlesList={circlesList}
          handleCirclesClick={handleCirclesClick}
          shadows={settings.shadows}
        />
      </Canvas>

      <div className="crosshair">
        <span className="left" />
        <span className="right" />
      </div>
    </div>
  );
}

/* ================= FIREBASE ================= */

const firebaseConfig = { /* senin config burada */ };
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ================= APP ================= */

export default function App() {
  const [name, setName] = useState<string | null>(null);
  const [inputName, setInputName] = useState("");
  const [shoots, setShoots] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState<GameSettings>(() => {
    const saved = localStorage.getItem("gameSettings");
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem("playerName");
    if (savedName) setName(savedName);
  }, []);

  /* TIMER */
  useEffect(() => {
    let timer: number | undefined;

    if (isPlaying && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }

    if (timeLeft === 0) setIsPlaying(false);

    return () => timer && clearInterval(timer);
  }, [isPlaying, timeLeft]);

  /* SCORE SAVE */
  const saveScoreToFirebase = async (playerName: string, score: number) => {
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
        await update(ref(db, `players/${existingKey}`), { score });
      }
    } else {
      await push(playersRef, { name: playerName, score });
    }

    loadScoreboard();
  };

  function loadScoreboard() {
    const playersRef = ref(db, "players");

    return onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.values(data as Record<string, Player>).sort(
          (a, b) => b.score - a.score
        );
        setPlayers(list);
      } else setPlayers([]);

      setLoading(false);
    });
  }

  useEffect(() => {
    if (timeLeft === 0 && name) {
      saveScoreToFirebase(name, shoots);
    }
  }, [timeLeft]);

  useEffect(() => loadScoreboard(), []);

  const startGame = () => {
    setShoots(0);
    setTimeLeft(30);
    setIsPlaying(true);
  };

  const saveName = () => {
    if (!inputName.trim()) return;
    localStorage.setItem("playerName", inputName);
    setName(inputName);
  };

  /* ================= RENDER ================= */

  if (!name) {
    return (
      <div className="username-container">
        <h2>Username</h2>
        <input
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
        />
        <button onClick={saveName}>Done</button>
      </div>
    );
  }

  return (
    <div className="main-container">
      {!isPlaying && timeLeft === 30 && (
        <div className="menu-container">
          <button onClick={startGame}>Start Game</button>
          <button onClick={() => setShowSettings(true)}>Settings</button>
        </div>
      )}

      {isPlaying && (
        <>
          <div className="hud-container">
            <h2>Timer: {timeLeft}</h2>
            <h3>Score: {shoots}</h3>
          </div>
          <GameArea setShoots={setShoots} settings={settings} />
        </>
      )}

      {!isPlaying && timeLeft === 0 && (
        <div className="gameover-container">
          <h1>Game Over</h1>
          <h2>Score: {shoots}</h2>
          <button onClick={startGame}>Play Again</button>
          <button onClick={() => setShowSettings(true)}>Settings</button>
        </div>
      )}

      {showSettings && (
        <div className="settings-overlay">
          <div className="settings-popup">
            <h2>Settings</h2>

            <label>
              Shadows
              <input
                type="checkbox"
                checked={settings.shadows}
                onChange={(e) =>
                  setSettings({ ...settings, shadows: e.target.checked })
                }
              />
            </label>

            <label>
              Texture Repeat
              <input
                type="number"
                value={settings.textureRepeat}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    textureRepeat: Number(e.target.value),
                  })
                }
              />
            </label>

            <label>
              Camera Far
              <input
                type="number"
                value={settings.cameraFar}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    cameraFar: Number(e.target.value),
                  })
                }
              />
            </label>

            <button
              onClick={() => {
                localStorage.setItem(
                  "gameSettings",
                  JSON.stringify(settings)
                );
                setShowSettings(false);
              }}
            >
              Save
            </button>

            <button onClick={() => setShowSettings(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}