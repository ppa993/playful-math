import { useCallback, useEffect, useRef, useState } from "react";

type ComparisonOperator = "<" | ">";
type Problem =
  | { kind: "arithmetic"; a: number; b: number; op: "+" | "-"; answer: number; options: number[]; emoji: string }
  | { kind: "find-number"; a: number; operator: ComparisonOperator; answer: number; options: number[] }
  | { kind: "find-symbol"; a: number; b: number; answer: ComparisonOperator; options: ComparisonOperator[] };
type GameMode = "mixed" | "addition" | "subtraction" | "find-number" | "find-symbol";

const EMOJIS = ["🍎", "⭐", "🐟", "🍓", "🎈", "🐞", "🍪", "🌸"];
const PRAISE = [
  { text: "Giỏi lắm!", clip: "praise-1" },
  { text: "Tuyệt vời!", clip: "praise-2" },
  { text: "Con làm tốt lắm!", clip: "praise-3" },
  { text: "Xuất sắc!", clip: "praise-4" },
  { text: "Hay quá!", clip: "praise-5" },
  { text: "Con làm được rồi!", clip: "praise-6" },
];
const BTN_COLORS = ["#ff6b9d", "#4dabf7", "#ffa94d", "#9775fa"];
const BTN_SHADOWS = ["#c53e70", "#2374bd", "#cf6a19", "#6745bd"];
const VIETNAMESE_NUMBERS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín", "mười"];
const rand = (n: number) => Math.floor(Math.random() * n);
const vietnameseNumber = (value: number) => VIETNAMESE_NUMBERS[value] ?? String(value);
const comparisonPrompt = (a: number, b: number) =>
  `${vietnameseNumber(a).replace(/^./, (letter) => letter.toLocaleUpperCase("vi-VN"))} nhỏ hơn hay lớn hơn ${vietnameseNumber(b)}?`;
const problemKey = (problem: Problem) => {
  if (problem.kind === "arithmetic") return `${problem.a}${problem.op}${problem.b}`;
  if (problem.kind === "find-number") return `${problem.a}${problem.operator}?${problem.answer}`;
  return `${problem.a}?${problem.b}`;
};

function makeProblem(previousKey?: string, mode: GameMode = "mixed"): Problem {
  if (mode === "mixed") {
    const mixedMode: GameMode[] = ["addition", "subtraction", "find-number", "find-symbol"];
    return makeProblem(previousKey, mixedMode[rand(mixedMode.length)]);
  }

  if (mode === "find-number") {
    const a = rand(8) + 2;
    const operator: ComparisonOperator = rand(2) === 0 ? "<" : ">";
    const answerOptions = Array.from({ length: 10 }, (_, i) => i + 1)
      .filter((value) => operator === "<" ? value > a : value < a);
    const distractors = Array.from({ length: 10 }, (_, i) => i + 1)
      .filter((value) => operator === "<" ? value <= a : value >= a);
    const answer = answerOptions[rand(answerOptions.length)];
    const problem: Problem = {
      kind: "find-number",
      a,
      operator,
      answer,
      options: [answer, ...distractors.sort(() => Math.random() - 0.5).slice(0, 3)].sort(() => Math.random() - 0.5),
    };
    return previousKey === problemKey(problem) ? makeProblem(previousKey, mode) : problem;
  }

  if (mode === "find-symbol") {
    const a = rand(10) + 1;
    let b = rand(10) + 1;
    while (b === a) b = rand(10) + 1;
    const problem: Problem = {
      kind: "find-symbol",
      a,
      b,
      answer: a < b ? "<" : ">",
      options: ["<", ">"],
    };
    return previousKey === problemKey(problem) ? makeProblem(previousKey, mode) : problem;
  }

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
  const problemId = `${a}${op}${b}`;
  if (previousKey === problemId) return makeProblem(previousKey, mode);
  const set = new Set([answer]);
  while (set.size < 4) set.add(rand(10) + 1);
  const options = [...set].sort(() => Math.random() - 0.5);
  return { kind: "arithmetic", a, b, op, answer, options, emoji: EMOJIS[rand(EMOJIS.length)] };
}

let ctx: AudioContext | null = null;
const audioBuffers = new Map<string, Promise<AudioBuffer>>();
const activeClipSources = new Set<AudioBufferSourceNode>();
let audioPlaybackGeneration = 0;
let audioSequenceQueue: Promise<void> = Promise.resolve();

function getAudioContext() {
  if (ctx) return ctx;
  const AudioContextClass = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  ctx = new AudioContextClass();
  return ctx;
}

function getAudioBuffer(name: string, audioContext: AudioContext) {
  const url = `${import.meta.env.BASE_URL}audio/${name}.mp3`;
  const cached = audioBuffers.get(url);
  if (cached) return cached;

  const buffer = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load audio clip: ${name}`);
      return response.arrayBuffer();
    })
    .then((data) => audioContext.decodeAudioData(data))
    .then(trimAudioBuffer)
    .catch((error: unknown) => {
      audioBuffers.delete(url);
      throw error;
    });
  audioBuffers.set(url, buffer);
  return buffer;
}

function trimAudioBuffer(buffer: AudioBuffer) {
  const frameSize = Math.max(1, Math.round(buffer.sampleRate * 0.005));
  const edgePadding = Math.round(buffer.sampleRate * 0.008);
  const threshold = 0.004;
  const frameHasSound = (frame: number) => {
    const start = frame * frameSize;
    const end = Math.min(buffer.length, start + frameSize);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let sample = start; sample < end; sample++) {
        if (Math.abs(samples[sample]) >= threshold) return true;
      }
    }
    return false;
  };

  let firstSoundFrame = 0;
  let lastSoundFrame = Math.ceil(buffer.length / frameSize) - 1;
  while (firstSoundFrame <= lastSoundFrame && !frameHasSound(firstSoundFrame)) firstSoundFrame++;
  while (lastSoundFrame >= firstSoundFrame && !frameHasSound(lastSoundFrame)) lastSoundFrame--;
  if (firstSoundFrame > lastSoundFrame) return buffer;

  const start = Math.max(0, firstSoundFrame * frameSize - edgePadding);
  const end = Math.min(buffer.length, (lastSoundFrame + 1) * frameSize + edgePadding);
  if (start === 0 && end === buffer.length) return buffer;

  const trimmed = new AudioBuffer({
    numberOfChannels: buffer.numberOfChannels,
    length: end - start,
    sampleRate: buffer.sampleRate,
  });
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    trimmed.copyToChannel(buffer.getChannelData(channel).subarray(start, end), channel);
  }
  return trimmed;
}

function playClips(names: string[]) {
  const generation = audioPlaybackGeneration;
  const sequence = audioSequenceQueue.then(async () => {
    try {
      const audioContext = getAudioContext();
      if (!audioContext) return;
      if (audioContext.state === "suspended") await audioContext.resume();
      const buffers = await Promise.all(names.map((name) => getAudioBuffer(name, audioContext)));
      if (generation !== audioPlaybackGeneration || audioContext.state !== "running") return;

      let startAt = audioContext.currentTime + 0.02;
      const sources = buffers.map((buffer) => {
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        activeClipSources.add(source);
        source.addEventListener("ended", () => activeClipSources.delete(source), { once: true });
        const sourceStart = startAt;
        startAt += buffer.duration;
        return { source, sourceStart };
      });
      const lastSource = sources.at(-1)?.source;
      if (!lastSource) return;

      const finished = new Promise<void>((resolve) => {
        lastSource.addEventListener("ended", () => resolve(), { once: true });
      });
      for (const { source, sourceStart } of sources) source.start(sourceStart);
      await finished;
    } catch {}
  });
  audioSequenceQueue = sequence;
  return sequence;
}

function cancelAudioPlayback() {
  audioPlaybackGeneration++;
  for (const source of activeClipSources) {
    try {
      source.stop();
    } catch {}
  }
  activeClipSources.clear();
  audioSequenceQueue = Promise.resolve();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

function questionClips(problem: Problem) {
  const number = (value: number) => `number-${value}`;
  if (problem.kind === "arithmetic") {
    return [number(problem.a), problem.op === "+" ? "plus" : "minus", number(problem.b), "equals-question"];
  }
  if (problem.kind === "find-number") {
    return [problem.operator === "<" ? "choose-greater" : "choose-less", number(problem.a)];
  }
  return [number(problem.a), "less-or-greater", number(problem.b)];
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
      {n === 0 && <span className="zero">không</span>}
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
  const [hasStarted, setHasStarted] = useState(false);
  const [stars, setStars] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>("mixed");
  const [status, setStatus] = useState<"idle" | "right" | "wrong">("idle");
  const [wrong, setWrong] = useState<Array<number | ComparisonOperator>>([]);
  const [praise, setPraise] = useState("");
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [showAids] = useState(false);
  const audioUnlocked = useRef(false);
  const audioPlayingRef = useRef(false);
  const promptPlaybackId = useRef(0);
  const playLockedClips = (clips: string[]) => {
    const playbackId = ++promptPlaybackId.current;
    audioPlayingRef.current = true;
    setIsAudioPlaying(true);
    void playClips(clips).finally(() => {
      if (promptPlaybackId.current !== playbackId) return;
      audioPlayingRef.current = false;
      setIsAudioPlaying(false);
    });
  };
  const unlockAndStartAudio = (event?: { target: EventTarget | null }) => {
    unlockAudio();
    if (event?.target instanceof Element && event.target.closest(".mode-button, .start-button")) {
      audioUnlocked.current = true;
      return;
    }
    if (!audioUnlocked.current) {
      audioUnlocked.current = true;
      playLockedClips(questionClips(p));
    }
  };
  const next = useCallback(() => {
    setP((current) => makeProblem(problemKey(current), gameMode));
    setStatus("idle");
    setWrong([]);
  }, [gameMode]);

  const selectMode = (mode: GameMode) => {
    setGameMode(mode);
    if (!hasStarted) return;
    cancelAudioPlayback();
    promptPlaybackId.current++;
    audioPlayingRef.current = false;
    setIsAudioPlaying(false);
    audioUnlocked.current = true;
    setP((current) => makeProblem(problemKey(current), mode));
    setStatus("idle");
    setWrong([]);
  };

  const startGame = () => {
    cancelAudioPlayback();
    promptPlaybackId.current++;
    audioPlayingRef.current = false;
    setIsAudioPlaying(false);
    audioUnlocked.current = true;
    setP(makeProblem(undefined, gameMode));
    setStatus("idle");
    setWrong([]);
    setHasStarted(true);
  };

  useEffect(() => {
    if (!audioUnlocked.current) return;
    playLockedClips(questionClips(p));
  }, [p]);

  useEffect(() => {
    if (status !== "right") return;
    const t = setTimeout(next, 1800);
    return () => clearTimeout(t);
  }, [status, next]);

  const pick = (v: number | ComparisonOperator) => {
    if (audioPlayingRef.current || status === "right" || wrong.includes(v)) return;
    unlockAndStartAudio();
    if (v === p.answer) {
      setStatus("right");
      setStars((s) => s + 1);
      const selectedPraise = PRAISE[rand(PRAISE.length)];
      setPraise(selectedPraise.text);
      playLockedClips([selectedPraise.clip]);
      beep([523, 659, 784, 1047]);
    } else {
      setStatus("wrong");
      setWrong((w) => [...w, v]);
      setShakeKey((k) => k + 1);
      void playClips(["try-again"]);
      beep([300, 220], 0.15);
    }
  };

  return (
    <div className="app" onPointerDownCapture={unlockAndStartAudio} onClickCapture={unlockAndStartAudio}>
      <div className="background-decor" aria-hidden="true">
        <span className="bg-cloud bg-cloud-left">☁️</span>
        <span className="bg-cloud bg-cloud-right">☁️</span>
        <span className="bg-rainbow">🌈</span>
        <span className="bg-sun">☀️</span>
      </div>
      {status === "right" && <Confetti key={stars} />}
      <header className="top">
        <h1 className="title">Toán Vui!</h1>
        <div className="top-actions">
          <div className="mode-select" role="group" aria-label="Chọn dạng toán">
            {([
              ["mixed", "🎲 Trộn"],
              ["addition", "➕ Cộng"],
              ["subtraction", "➖ Trừ"],
              ["find-number", "🔢 Tìm số"],
              ["find-symbol", "🔎 Tìm dấu"],
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

      {!hasStarted ? (
        <div className="start-screen">
          <p className="ask">Chọn chế độ chơi</p>
          <button className="start-button" type="button" onClick={startGame}>Bắt đầu</button>
        </div>
      ) : (
      <>
      <main className={`card ${status === "wrong" ? "shake" : ""}`} key={shakeKey}>
        <div className="equation">
          {p.kind === "arithmetic" ? (
            <>
              <span className="num n1">{p.a}</span>
              <span className="op operator">{p.op}</span>
              <span className="num n2">{p.b}</span>
              <span className="op equals">=</span>
              <span className={`num q ${status === "right" ? "solved" : ""}`}>{status === "right" ? p.answer : "?"}</span>
            </>
          ) : p.kind === "find-number" ? (
            <>
              <span className="num n1">{p.a}</span>
              <span className="op operator">{p.operator}</span>
              <span className={`num q ${status === "right" ? "solved" : ""}`}>{status === "right" ? p.answer : "?"}</span>
            </>
          ) : (
            <>
              <span className="num n1">{p.a}</span>
              <span className={`num q ${status === "right" ? "solved" : ""}`}>{status === "right" ? p.answer : "?"}</span>
              <span className="num n2">{p.b}</span>
            </>
          )}
        </div>

        {showAids && p.kind === "arithmetic" && (
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
                <div className="hint">Bỏ đi {p.b}! ✖️</div>
              </div>
            )}
          </div>
        )}

        <div className="msg">
          {status === "right" && <span className="praise">🎉 {praise} 🎉</span>}
          {status === "wrong" && <span className="try">Chưa đúng, thử lại nhé! 💪</span>}
          {status === "idle" && <span className="ask">{p.kind === "find-symbol" ? comparisonPrompt(p.a, p.b) : "Chọn đáp án!"}</span>}
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
                className={`opt ${isWrong ? "used" : ""} ${isRight ? "correct" : ""}`}
                style={{ background, "--opt-shadow": shadow }}
                disabled={isAudioPlaying || isWrong || status === "right"}
              >
                {v}
              </button>
            );
          })}
        </div>
      </main>
      </>
      )}
    </div>
  );
}
