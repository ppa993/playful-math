import { useCallback, useEffect, useState } from "react";

type Problem = { a: number; b: number; op: "+" | "-"; answer: number; options: number[]; emoji: string };
type GameMode = "mixed" | "addition" | "subtraction";

const EMOJIS = ["🍎", "⭐", "🐟", "🍓", "🎈", "🐞", "🍪", "🌸"];
const PRAISE = ["Great Job!", "Awesome!", "Super Star!", "You Did It!", "Amazing!", "Wow!"];
const BTN_COLORS = ["#ff6b9d", "#4dabf7", "#ffa94d", "#9775fa"];
const BTN_SHADOWS = ["#c53e70", "#2374bd", "#cf6a19", "#6745bd"];
const rand = (n: number) => Math.floor(Math.random() * n);
const problemKey = (a: number, b: number, op: Problem["op"]) => `${a}${op}${b}`;

function makeProblem(previousKey?: string, mode: GameMode = "mixed"): Problem {
  const op = mode === "addition" ? "+" : mode === "subtraction" ? "-" : Math.random() < 0.5 ? "+" : "-";
  let a: number, b: number, answer: number;
  if (op === "+") {
    a = rand(9) + 1;
    b = rand(10 - a) + 1;
    answer = a + b;
  } else {
    a = rand(9) + 2;
    b = rand(a - 1) + 1;
    answer = a - b;
  }
  if (previousKey === problemKey(a, b, op)) return makeProblem(previousKey, mode);
  const set = new Set([answer]);
  while (set.size < 4) set.add(rand(10) + 1);
  const options = [...set].sort(() => Math.random() - 0.5);
  return { a, b, op, answer, options, emoji: EMOJIS[rand(EMOJIS.length)] };
}

let ctx: AudioContext | null = null;
function getAudioContext() {
  if (ctx) return ctx;
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  ctx = new AudioContextClass();
  return ctx;
}

function unlockAudio() {
  try {
    const audioContext = getAudioContext();
    if (audioContext?.state === "suspended") void audioContext.resume();
  } catch {}
}

function beep(freqs: number[], dur = 0.12) {
  try {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    if (audioContext.state === "suspended") void audioContext.resume();
    freqs.forEach((f, i) => {
      const o = audioContext.createOscillator();
      const g = audioContext.createGain();
      o.frequency.value = f;
      o.type = "triangle";
      const t = audioContext.currentTime + i * dur;
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(audioContext.destination);
      o.start(t);
      o.stop(t + dur);
    });
  } catch {}
}

function speak(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    const speech = window.speechSynthesis;
    speech.cancel();
    const voices = speech.getVoices();
    const feminineName = /\b(female|woman|samantha|victoria|karen|moira|tessa|fiona|zira|aria|jenny|susan|sara|ava|allison|joanna|kendra|kimberly|salli|ivy)\b/i;
    const englishVoice = (voice: SpeechSynthesisVoice) => voice.lang.toLowerCase().startsWith("en");
    const preferredVoice = voices.find((voice) => englishVoice(voice) && feminineName.test(voice.name))
      ?? voices.find((voice) => englishVoice(voice) && /google.*english/i.test(voice.name))
      ?? voices.find((voice) => englishVoice(voice) && voice.default)
      ?? voices.find(englishVoice)
      ?? voices.find((voice) => voice.default);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.1;
    if (preferredVoice) utterance.voice = preferredVoice;
    speech.speak(utterance);
  } catch {}
}

function Confetti() {
  const colors = ["#ff6b9d", "#ffd43b", "#69db7c", "#4dabf7", "#9775fa", "#ffa94d"];
  return (
    <div className="confetti">
      {Array.from({ length: 80 }).map((_, i) => (
        <span
          key={i}
          style={{
            left: `${Math.random() * 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${Math.random() * 0.4}s`,
            animationDuration: `${1.2 + Math.random()}s`,
            transform: `rotate(${rand(360)}deg)`,
            borderRadius: i % 2 ? "50%" : "3px",
          }}
        />
      ))}
    </div>
  );
}

function Tokens({ n, emoji, faded = 0 }: { n: number; emoji: string; faded?: number }) {
  return (
    <div className="tokens">
      {n === 0 && <span className="zero">none</span>}
      {Array.from({ length: n }).map((_, i) => (
        <span key={i} className={`token ${i >= n - faded ? "crossed" : ""}`} style={{ animationDelay: `${i * 0.05}s` }}>
          {emoji}
        </span>
      ))}
    </div>
  );
}

export default function App() {
  const [p, setP] = useState<Problem>(makeProblem);
  const [stars, setStars] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>("mixed");
  const [status, setStatus] = useState<"idle" | "right" | "wrong">("idle");
  const [wrong, setWrong] = useState<number[]>([]);
  const [praise, setPraise] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [showAids] = useState(false);
  const next = useCallback(() => {
    setP((current) => makeProblem(problemKey(current.a, current.b, current.op), gameMode));
    setStatus("idle");
    setWrong([]);
  }, [gameMode]);

  const selectMode = (mode: GameMode) => {
    setGameMode(mode);
    setP((current) => makeProblem(problemKey(current.a, current.b, current.op), mode));
    setStatus("idle");
    setWrong([]);
  };

  useEffect(() => {
    speak(`What is ${p.a} ${p.op === "+" ? "plus" : "minus"} ${p.b}?`);
  }, [p.a, p.b, p.op]);

  useEffect(() => {
    if (status !== "right") return;
    const t = setTimeout(next, 1800);
    return () => clearTimeout(t);
  }, [status, next]);

  const pick = (v: number) => {
    if (status === "right" || wrong.includes(v)) return;
    if (v === p.answer) {
      setStatus("right");
      setStars((s) => s + 1);
      const selectedPraise = PRAISE[rand(PRAISE.length)];
      setPraise(selectedPraise);
      speak(selectedPraise);
      beep([523, 659, 784, 1047]);
    } else {
      setStatus("wrong");
      setWrong((w) => [...w, v]);
      setShakeKey((k) => k + 1);
      speak("Oops! Try again!");
      beep([300, 220], 0.15);
    }
  };

  return (
    <div className="app">
      <div className="background-decor" aria-hidden="true">
        <span className="bg-cloud bg-cloud-left">☁️</span>
        <span className="bg-cloud bg-cloud-right">☁️</span>
        <span className="bg-rainbow">🌈</span>
        <span className="bg-sun">☀️</span>
      </div>
      {status === "right" && <Confetti key={stars} />}
      <header className="top">
        <h1 className="title">Math Fun!</h1>
        <div className="top-actions">
          <div className="mode-select" role="group" aria-label="Choose math mode">
            {([
              ["mixed", "🎲 Mix"],
              ["addition", "➕ Plus"],
              ["subtraction", "➖ Minus"],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={`mode-button ${gameMode === mode ? "selected" : ""}`}
                aria-pressed={gameMode === mode}
                onClick={() => selectMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className={`card ${status === "wrong" ? "shake" : ""}`} key={shakeKey}>
        <div className="equation">
          <span className="num n1">{p.a}</span>
          <span className="op operator">{p.op}</span>
          <span className="num n2">{p.b}</span>
          <span className="op equals">=</span>
          <span className={`num q ${status === "right" ? "solved" : ""}`}>{status === "right" ? p.answer : "?"}</span>
        </div>

        {showAids && (
          <div className="aids">
            {p.op === "+" ? (
              <>
                <Tokens n={p.a} emoji={p.emoji} />
                <span className="aid-op">+</span>
                <Tokens n={p.b} emoji={p.emoji} />
              </>
            ) : (
              <div className="sub-aid">
                <Tokens n={p.a} emoji={p.emoji} faded={p.b} />
                <div className="hint">Take away {p.b}! ✖️</div>
              </div>
            )}
          </div>
        )}

        <div className="msg">
          {status === "right" && <span className="praise">🎉 {praise} 🎉</span>}
          {status === "wrong" && <span className="try">Oops! Try Again! 💪</span>}
          {status === "idle" && <span className="ask">Pick the answer!</span>}
        </div>

        <div className="options">
          {p.options.map((v, i) => {
            const isWrong = wrong.includes(v);
            const isRight = status === "right" && v === p.answer;
            const background = isRight ? "#51cf66" : BTN_COLORS[i];
            const shadow = isWrong ? "#b9c1c9" : isRight ? "#258b3b" : BTN_SHADOWS[i];
            return (
              <button
                key={v}
                onClick={() => pick(v)}
                onPointerDown={unlockAudio}
                className={`opt ${isWrong ? "used" : ""} ${isRight ? "correct" : ""}`}
                style={{ background, "--opt-shadow": shadow }}
                disabled={isWrong}
              >
                {v}
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
