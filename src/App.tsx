import { useCallback, useEffect, useState } from "react";

type Problem = { a: number; b: number; op: "+" | "-"; answer: number; options: number[]; emoji: string };

const EMOJIS = ["🍎", "⭐", "🐟", "🍓", "🎈", "🐞", "🍪", "🌸"];
const PRAISE = ["Great Job!", "Awesome!", "Super Star!", "You Did It!", "Amazing!", "Wow!"];
const BTN_COLORS = ["#ff6b9d", "#4dabf7", "#ffa94d", "#9775fa"];
const rand = (n: number) => Math.floor(Math.random() * n);

function makeProblem(): Problem {
  const op = Math.random() < 0.5 ? "+" : "-";
  let a: number, b: number, answer: number;
  if (op === "+") {
    a = rand(11);
    b = rand(11 - a);
    answer = a + b;
  } else {
    a = rand(11);
    b = rand(a + 1);
    answer = a - b;
  }
  const set = new Set([answer]);
  while (set.size < 4) set.add(rand(11));
  const options = [...set].sort(() => Math.random() - 0.5);
  return { a, b, op, answer, options, emoji: EMOJIS[rand(EMOJIS.length)] };
}

let ctx: AudioContext | null = null;
function beep(freqs: number[], dur = 0.12) {
  try {
    ctx = ctx || new AudioContext();
    freqs.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.frequency.value = f;
      o.type = "triangle";
      const t = ctx!.currentTime + i * dur;
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + dur);
    });
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
  const [status, setStatus] = useState<"idle" | "right" | "wrong">("idle");
  const [wrong, setWrong] = useState<number[]>([]);
  const [praise, setPraise] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [showAids, setShowAids] = useState(true);

  const next = useCallback(() => {
    setP(makeProblem());
    setStatus("idle");
    setWrong([]);
  }, []);

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
      setPraise(PRAISE[rand(PRAISE.length)]);
      beep([523, 659, 784, 1047]);
    } else {
      setStatus("wrong");
      setWrong((w) => [...w, v]);
      setShakeKey((k) => k + 1);
      beep([300, 220], 0.15);
    }
  };

  return (
    <div className="app">
      {status === "right" && <Confetti key={stars} />}
      <header className="top">
        <h1 className="title">Math Fun!</h1>
        <div className="top-actions">
          <button
            className="stars"
            type="button"
            onDoubleClick={() => setShowAids((visible) => !visible)}
            aria-pressed={showAids}
            aria-label="Double-click to show or hide aids"
          >
            ⭐ {stars} {stars === 1 ? "Star" : "Stars"}!
          </button>
        </div>
      </header>

      <main className={`card ${status === "wrong" ? "shake" : ""}`} key={shakeKey}>
        <div className="equation">
          <span className="num n1">{p.a}</span>
          <span className="op">{p.op}</span>
          <span className="num n2">{p.b}</span>
          <span className="op">=</span>
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
            return (
              <button
                key={v}
                onClick={() => pick(v)}
                className={`opt ${isWrong ? "used" : ""} ${isRight ? "correct" : ""}`}
                style={{ background: isRight ? "#51cf66" : BTN_COLORS[i] }}
                disabled={isWrong}
              >
                {v}
              </button>
            );
          })}
        </div>

        {status === "right" && (
          <button className="next" onClick={next}>Next Question ➔</button>
        )}
      </main>
    </div>
  );
}
