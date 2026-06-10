import { useState, useCallback, useEffect, useRef } from "react";

const DIFFICULTY_CONFIG = {
  easy: { label: "Easy", color: "#4ade80", desc: "Basic recall & definitions" },
  medium: { label: "Medium", color: "#facc15", desc: "Application & comparison" },
  hard: { label: "Hard", color: "#f87171", desc: "Analysis & edge cases" },
};

const MODE_FLASHCARD = "flashcard";
const MODE_QUIZ = "quiz";
const MODE_IT = "it";

const IT_CATEGORIES = [
  { id: "networking", label: "Networking", icon: "🌐", desc: "TCP/IP, DNS, HTTP, OSI model" },
  { id: "os", label: "Operating Systems", icon: "💻", desc: "Linux, Windows, processes, memory" },
  { id: "databases", label: "Databases", icon: "🗄️", desc: "SQL, NoSQL, indexing, transactions" },
  { id: "security", label: "Cybersecurity", icon: "🔐", desc: "Encryption, attacks, firewalls" },
  { id: "programming", label: "Programming", icon: "⌨️", desc: "OOP, algorithms, data structures" },
  { id: "cloud", label: "Cloud & DevOps", icon: "☁️", desc: "AWS, Docker, CI/CD, Kubernetes" },
  { id: "hardware", label: "Hardware", icon: "🖥️", desc: "CPU, RAM, storage, motherboards" },
  { id: "webdev", label: "Web Development", icon: "🌍", desc: "HTML, CSS, JS, REST APIs" },
];

const IT_DIFFICULTY = {
  easy: "beginner-level, simple definitions and basic concepts",
  medium: "intermediate-level, how things work and why",
  hard: "advanced-level, edge cases, internals, and expert knowledge",
};

const TIMER_SECONDS = 20;

// ─── Helpers ───────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function callClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  const text = data.content.map(b => b.text || "").join("");
  return text.replace(/```json|```/g, "").trim();
}

// ─── Shared UI ─────────────────────────────────────────────────────────────

function Btn({ onClick, disabled, children, variant = "primary", small }) {
  const base = {
    borderRadius: 12, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 600,
    fontSize: small ? 13 : 15, border: "none", transition: "all 0.2s",
    padding: small ? "8px 18px" : "12px 26px",
  };
  const styles = {
    primary: { background: disabled ? "#0e4a56" : "linear-gradient(90deg,#0891b2,#22d3ee)", color: disabled ? "#475569" : "#020c14" },
    ghost: { background: "transparent", border: "1.5px solid #1e293b", color: "#94a3b8" },
    danger: { background: "#2d0a0a", border: "1.5px solid #f87171", color: "#f87171" },
    success: { background: "#052e16", border: "1.5px solid #4ade80", color: "#4ade80" },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...styles[variant] }}>{children}</button>;
}

function Tag({ children, color = "#22d3ee" }) {
  return (
    <span style={{ fontFamily: "monospace", fontSize: 11, color, letterSpacing: 2, textTransform: "uppercase",
      padding: "3px 10px", border: `1px solid ${color}33`, borderRadius: 20, background: `${color}0a` }}>
      {children}
    </span>
  );
}

function ProgressBar({ value, max, color = "#22d3ee" }) {
  return (
    <div style={{ width: "100%", height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.round((value / max) * 100)}%`, background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
    </div>
  );
}

// ─── Timer Ring ─────────────────────────────────────────────────────────────

function TimerRing({ seconds, total }) {
  const pct = seconds / total;
  const r = 20, circ = 2 * Math.PI * r;
  const color = seconds > total * 0.5 ? "#22d3ee" : seconds > total * 0.25 ? "#facc15" : "#f87171";
  return (
    <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle cx="26" cy="26" r={r} fill="none" stroke="#1e293b" strokeWidth="4" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" transform="rotate(-90 26 26)"
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.3s" }} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "monospace", fontWeight: 700, fontSize: 14, color }}>{seconds}</span>
    </div>
  );
}

// ─── FlashCard ──────────────────────────────────────────────────────────────

function FlashCard({ card, index, total, status, onKnow, onLearning }) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => { setFlipped(false); }, [index]);

  const statusColor = status === "known" ? "#4ade80" : status === "learning" ? "#facc15" : "#334155";
  const statusLabel = status === "known" ? "✓ Known" : status === "learning" ? "↺ Learning" : "Unseen";

  return (
    <div>
      <div style={{ perspective: "1200px", width: "100%", maxWidth: 560, margin: "0 auto" }}>
        <div onClick={() => setFlipped(f => !f)} style={{
          position: "relative", width: "100%", height: 230, cursor: "pointer",
          transformStyle: "preserve-3d",
          transition: "transform 0.55s cubic-bezier(.4,0,.2,1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}>
          {/* Front */}
          <div style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden",
            background: "linear-gradient(135deg,#0f172a,#1e293b)",
            border: `1.5px solid ${statusColor}44`, borderRadius: 18, padding: "28px 32px",
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            boxShadow: "0 8px 40px #00000060",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Tag color="#22d3ee">Question</Tag>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: statusColor }}>{statusLabel}</span>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "#475569" }}>{index + 1}/{total}</span>
              </div>
            </div>
            <p style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 18, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.5, margin: 0 }}>
              {card.front}
            </p>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#334155", letterSpacing: 1 }}>tap to reveal →</span>
          </div>
          {/* Back */}
          <div style={{
            position: "absolute", inset: 0, backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: "linear-gradient(135deg,#083344,#0e2a38)",
            border: "1.5px solid #22d3ee88", borderRadius: 18, padding: "28px 32px",
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            boxShadow: "0 8px 40px #00000060",
          }}>
            <Tag color="#22d3ee">Answer</Tag>
            <p style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 17, fontWeight: 500, color: "#e2f8fd", lineHeight: 1.6, margin: "16px 0" }}>
              {card.back}
            </p>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#164e63", letterSpacing: 1 }}>tap to flip back ↺</span>
          </div>
        </div>
      </div>

      {/* Mark buttons — only show after flip */}
      {flipped && (
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 20 }}>
          <Btn variant="danger" small onClick={() => { onLearning(); setFlipped(false); }}>↺ Still Learning</Btn>
          <Btn variant="success" small onClick={() => { onKnow(); setFlipped(false); }}>✓ Got It</Btn>
        </div>
      )}
    </div>
  );
}

// ─── FlashcardDeck ──────────────────────────────────────────────────────────

function FlashcardDeck({ cards: initialCards, onReset }) {
  const [cards, setCards] = useState(initialCards);
  const [index, setIndex] = useState(0);
  const [statuses, setStatuses] = useState(() => Object.fromEntries(initialCards.map((_, i) => [i, "unseen"])));
  const [done, setDone] = useState(false);
  const [shuffled, setShuffled] = useState(false);

  const known = Object.values(statuses).filter(s => s === "known").length;
  const learning = Object.values(statuses).filter(s => s === "learning").length;
  const unseen = Object.values(statuses).filter(s => s === "unseen").length;

  const markCard = (status) => {
    setStatuses(prev => ({ ...prev, [index]: status }));
    if (index + 1 >= cards.length) setDone(true);
    else setIndex(i => i + 1);
  };

  const handleShuffle = () => {
    const paired = cards.map((c, i) => ({ card: c, status: statuses[i] }));
    const shuffledPaired = shuffle(paired);
    setCards(shuffledPaired.map(p => p.card));
    setStatuses(Object.fromEntries(shuffledPaired.map((p, i) => [i, p.status])));
    setShuffled(true);
    setIndex(0);
  };

  const handleRestart = () => {
    setCards(initialCards);
    setStatuses(Object.fromEntries(initialCards.map((_, i) => [i, "unseen"])));
    setIndex(0);
    setDone(false);
    setShuffled(false);
  };

  const handleReviewLearning = () => {
    const learningCards = cards.filter((_, i) => statuses[i] === "learning");
    if (!learningCards.length) return;
    setCards(learningCards);
    setStatuses(Object.fromEntries(learningCards.map((_, i) => [i, "unseen"])));
    setIndex(0);
    setDone(false);
  };

  if (done) {
    return (
      <div style={{ background: "linear-gradient(135deg,#052e16,#0f172a)", border: "1.5px solid #22d3ee44", borderRadius: 20, padding: "44px 32px", textAlign: "center", boxShadow: "0 8px 40px #00000060" }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>{known === cards.length ? "🏆" : known >= cards.length * 0.7 ? "⚡" : "📚"}</div>
        <Tag color="#22d3ee">Deck Complete</Tag>
        <p style={{ fontSize: 44, fontWeight: 800, margin: "12px 0 4px", color: "#f1f5f9" }}>{known}/{cards.length}</p>
        <p style={{ fontFamily: "monospace", fontSize: 12, color: "#22d3ee", marginBottom: 6 }}>cards known</p>

        {/* Stats */}
        <div style={{ display: "flex", gap: 16, justifyContent: "center", margin: "20px 0 28px", flexWrap: "wrap" }}>
          {[["✓ Known", known, "#4ade80"], ["↺ Still Learning", learning, "#facc15"], ["— Unseen", unseen, "#475569"]].map(([l, v, c]) => (
            <div key={l} style={{ background: "#0f172a", border: `1px solid ${c}33`, borderRadius: 10, padding: "10px 18px", minWidth: 90 }}>
              <p style={{ margin: 0, fontFamily: "monospace", fontSize: 20, fontWeight: 800, color: c }}>{v}</p>
              <p style={{ margin: 0, fontFamily: "monospace", fontSize: 10, color: "#475569", letterSpacing: 1 }}>{l}</p>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {learning > 0 && <Btn variant="danger" onClick={handleReviewLearning}>↺ Review {learning} Learning Cards</Btn>}
          <Btn variant="ghost" onClick={handleRestart}>Restart Deck</Btn>
          <Btn variant="ghost" onClick={onReset}>← New Session</Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Progress row */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 14 }}>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#4ade80" }}>✓ {known} known</span>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#facc15" }}>↺ {learning} learning</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="ghost" small onClick={handleShuffle}>⇄ Shuffle</Btn>
            <Btn variant="ghost" small onClick={handleRestart}>↺ Restart</Btn>
          </div>
        </div>
        <ProgressBar value={known + learning} max={cards.length} color="#22d3ee" />
      </div>

      <FlashCard card={cards[index]} index={index} total={cards.length} status={statuses[index]}
        onKnow={() => markCard("known")} onLearning={() => markCard("learning")} />

      {/* Dot nav */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 24 }}>
        <Btn variant="ghost" small onClick={() => setIndex(i => Math.max(0, i - 1))} disabled={index === 0}>← Prev</Btn>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center", maxWidth: 280 }}>
          {cards.map((_, i) => {
            const s = statuses[i];
            const col = s === "known" ? "#4ade80" : s === "learning" ? "#facc15" : "#334155";
            return <button key={i} onClick={() => setIndex(i)} style={{ width: 8, height: 8, borderRadius: "50%", border: "none", cursor: "pointer", background: i === index ? "#22d3ee" : col, padding: 0, outline: i === index ? "2px solid #22d3ee55" : "none", outlineOffset: 2 }} />;
          })}
        </div>
        <Btn variant="ghost" small onClick={() => setIndex(i => Math.min(cards.length - 1, i + 1))} disabled={index === cards.length - 1}>Next →</Btn>
      </div>
    </div>
  );
}

// ─── QuizQuestion ───────────────────────────────────────────────────────────

function QuizQuestion({ q, index, total, onAnswer, timeLeft, timerTotal }) {
  const [selected, setSelected] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  const opts = ["A", "B", "C", "D"];

  useEffect(() => { setSelected(null); setTimedOut(false); }, [index]);

  useEffect(() => {
    if (timeLeft === 0 && !selected) {
      setTimedOut(true);
      onAnswer(false, null);
    }
  }, [timeLeft]);

  const handleSelect = (letter) => {
    if (selected || timedOut) return;
    setSelected(letter);
    onAnswer(letter === q.answer, letter);
  };

  return (
    <div style={{ background: "linear-gradient(135deg,#0f172a,#1e293b)", border: "1.5px solid #22d3ee33", borderRadius: 18, padding: "28px 28px 24px", maxWidth: 600, margin: "0 auto", boxShadow: "0 8px 40px #00000050" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <Tag color="#22d3ee">Q {index + 1} / {total}</Tag>
        <TimerRing seconds={timeLeft} total={timerTotal} />
      </div>
      <p style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 17, fontWeight: 600, color: "#f1f5f9", marginBottom: 22, lineHeight: 1.55, margin: "0 0 22px" }}>
        {q.question}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {opts.map(letter => {
          const isCorrect = letter === q.answer;
          const isSelected = letter === selected;
          let bg = "#1e293b", border = "#334155", color = "#94a3b8";
          if (selected || timedOut) {
            if (isCorrect) { bg = "#052e16"; border = "#4ade80"; color = "#4ade80"; }
            else if (isSelected) { bg = "#2d0a0a"; border = "#f87171"; color = "#f87171"; }
          }
          return (
            <button key={letter} onClick={() => handleSelect(letter)} style={{
              background: bg, border: `1.5px solid ${border}`, borderRadius: 10,
              padding: "11px 16px", cursor: (selected || timedOut) ? "default" : "pointer",
              color, fontFamily: "'Inter',system-ui,sans-serif", fontSize: 14,
              textAlign: "left", transition: "all 0.2s", display: "flex", gap: 10, alignItems: "flex-start",
            }}>
              <span style={{ fontFamily: "monospace", fontWeight: 700, minWidth: 22, flexShrink: 0 }}>{letter})</span>
              {q.options[letter]}
            </button>
          );
        })}
      </div>
      {(selected || timedOut) && (
        <div style={{ marginTop: 18, padding: "13px 16px", background: timedOut ? "#1a0a00" : "#0f2d1f", border: "1px solid #22d3ee22", borderRadius: 10, color: "#a5f3fc", fontFamily: "'Inter',system-ui,sans-serif", fontSize: 13, lineHeight: 1.6 }}>
          {timedOut && <span style={{ color: "#f87171", fontWeight: 700 }}>⏱ Time's up! </span>}
          <strong style={{ color: "#22d3ee" }}>Why: </strong>{q.explanation}
        </div>
      )}
    </div>
  );
}

// ─── ReviewScreen ───────────────────────────────────────────────────────────

function ReviewScreen({ questions, answers, onRetry, onBack, title }) {
  const [open, setOpen] = useState(null);
  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <Tag color="#22d3ee">{title} · All Answers</Tag>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="primary" small onClick={onRetry}>Retry Quiz</Btn>
          <Btn variant="ghost" small onClick={onBack}>← Back</Btn>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {questions.map((q, i) => {
          const userAns = answers[i];
          const correct = userAns === q.answer;
          const timedOut = userAns === null;
          const icon = timedOut ? "⏱" : correct ? "✓" : "✗";
          const col = timedOut ? "#facc15" : correct ? "#4ade80" : "#f87171";
          const isOpen = open === i;
          return (
            <div key={i} style={{ background: "#0f172a", border: `1.5px solid ${col}33`, borderRadius: 14, overflow: "hidden", cursor: "pointer" }} onClick={() => setOpen(isOpen ? null : i)}>
              <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 15, color: col }}>{icon}</span>
                  <span style={{ fontFamily: "'Inter',system-ui,sans-serif", fontSize: 14, color: "#cbd5e1", lineHeight: 1.4 }}>{q.question}</span>
                </div>
                <span style={{ color: "#475569", fontSize: 12, flexShrink: 0, marginLeft: 12 }}>{isOpen ? "▲" : "▼"}</span>
              </div>
              {isOpen && (
                <div style={{ padding: "0 18px 16px", borderTop: `1px solid ${col}22` }}>
                  {!correct && !timedOut && <p style={{ margin: "12px 0 4px", fontFamily: "monospace", fontSize: 12, color: "#f87171" }}>Your answer: {userAns}) {q.options[userAns]}</p>}
                  {timedOut && <p style={{ margin: "12px 0 4px", fontFamily: "monospace", fontSize: 12, color: "#facc15" }}>Timed out — no answer selected</p>}
                  <p style={{ margin: "8px 0 4px", fontFamily: "monospace", fontSize: 12, color: "#4ade80" }}>Correct: {q.answer}) {q.options[q.answer]}</p>
                  <p style={{ margin: "8px 0 0", fontFamily: "'Inter',system-ui,sans-serif", fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ScoreScreen ────────────────────────────────────────────────────────────

function ScoreScreen({ score, total, timeTaken, answers, questions, onRetry, onBack, categoryLabel, onReview }) {
  const pct = Math.round((score / total) * 100);
  const timedOut = answers.filter(a => a === null).length;
  const wrong = total - score - timedOut;
  return (
    <div style={{ background: "linear-gradient(135deg,#052e16,#0f172a)", border: "1.5px solid #22d3ee44", borderRadius: 20, padding: "44px 32px", textAlign: "center", boxShadow: "0 8px 40px #00000060" }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>{score === total ? "🏆" : pct >= 75 ? "⚡" : pct >= 50 ? "📚" : "🔄"}</div>
      {categoryLabel && <Tag color="#22d3ee">{categoryLabel}</Tag>}
      <p style={{ fontSize: 48, fontWeight: 800, margin: "12px 0 4px", color: "#f1f5f9" }}>{score}/{total}</p>
      <p style={{ fontFamily: "monospace", fontSize: 13, color: "#22d3ee", marginBottom: 4 }}>{pct}% correct</p>
      {timeTaken != null && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#475569", marginBottom: 0 }}>Completed in {timeTaken}s</p>}

      <div style={{ display: "flex", gap: 14, justifyContent: "center", margin: "22px 0 28px", flexWrap: "wrap" }}>
        {[["✓ Correct", score, "#4ade80"], ["✗ Wrong", wrong, "#f87171"], ["⏱ Timed Out", timedOut, "#facc15"]].map(([l, v, c]) => (
          <div key={l} style={{ background: "#0f172a", border: `1px solid ${c}33`, borderRadius: 10, padding: "10px 16px", minWidth: 80 }}>
            <p style={{ margin: 0, fontFamily: "monospace", fontSize: 22, fontWeight: 800, color: c }}>{v}</p>
            <p style={{ margin: 0, fontFamily: "monospace", fontSize: 10, color: "#475569", letterSpacing: 1 }}>{l}</p>
          </div>
        ))}
      </div>

      <p style={{ color: "#64748b", marginBottom: 28, fontSize: 15 }}>
        {score === total ? "Perfect score! You nailed it." : pct >= 75 ? "Great job! Almost perfect." : pct >= 50 ? "Good effort — keep studying!" : "Keep at it — review and try again."}
      </p>

      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Btn onClick={onRetry}>Retry Quiz</Btn>
        <Btn variant="ghost" onClick={onReview}>📋 Review Answers</Btn>
        <Btn variant="ghost" onClick={onBack}>← Back</Btn>
      </div>
    </div>
  );
}

// ─── QuizRunner ─────────────────────────────────────────────────────────────

function QuizRunner({ questions: initialQs, title, onBack }) {
  const [questions] = useState(() => shuffle(initialQs));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [startTime] = useState(Date.now());
  const [timeTaken, setTimeTaken] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setTimeLeft(TIMER_SECONDS);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [index]);

  const handleAnswer = (correct, letter) => {
    clearInterval(timerRef.current);
    const newAnswers = [...answers, letter ?? null];
    if (correct) setScore(s => s + 1);
    setAnswers(newAnswers);
    setTimeout(() => {
      if (index + 1 >= questions.length) {
        setTimeTaken(Math.round((Date.now() - startTime) / 1000));
        setDone(true);
      } else {
        setIndex(i => i + 1);
      }
    }, 1500);
  };

  if (reviewing) return <ReviewScreen questions={questions} answers={answers} title={title} onRetry={onBack} onBack={() => setReviewing(false)} />;

  if (done) return (
    <ScoreScreen score={score} total={questions.length} timeTaken={timeTaken}
      answers={answers} questions={questions} categoryLabel={title}
      onRetry={onBack} onBack={onBack}
      onReview={() => setReviewing(true)} />
  );

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#475569" }}>{title}</span>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "#475569" }}>Score: {score}</span>
        </div>
        <ProgressBar value={index} max={questions.length} />
      </div>
      <QuizQuestion q={questions[index]} index={index} total={questions.length}
        onAnswer={handleAnswer} timeLeft={timeLeft} timerTotal={TIMER_SECONDS} />
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode] = useState(MODE_FLASHCARD);
  // Flashcard state
  const [studyText, setStudyText] = useState("");
  const [fcDifficulty, setFcDifficulty] = useState("medium");
  const [cards, setCards] = useState([]);
  // Custom quiz state
  const [topic, setTopic] = useState("");
  const [customQuestions, setCustomQuestions] = useState([]);
  // IT quiz state
  const [itCategory, setItCategory] = useState(null);
  const [itDifficulty, setItDifficulty] = useState("medium");
  const [itQuestions, setItQuestions] = useState([]);
  // Shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [screen, setScreen] = useState("input"); // input | deck | quiz

  const switchMode = (m) => { setMode(m); setScreen("input"); setError(""); setItCategory(null); };

  const generateFlashcards = async () => {
    if (!studyText.trim()) { setError("Please enter some study material."); return; }
    setLoading(true); setError("");
    try {
      const raw = await callClaude(`Convert this study material into 7-10 flashcards.

Study material:
${studyText}

Difficulty: ${fcDifficulty}
Rules: Focus on key facts, use varied question types (definition, cause/effect, comparison, how-to), one-sentence answers.

Respond ONLY with a JSON array, no markdown:
[{"front":"Question?","back":"Answer."}]`);
      setCards(JSON.parse(raw));
      setScreen("deck");
    } catch { setError("Failed to generate. Please try again."); }
    finally { setLoading(false); }
  };

  const generateCustomQuiz = async () => {
    if (!topic.trim()) { setError("Please enter a topic."); return; }
    setLoading(true); setError("");
    try {
      const raw = await callClaude(`Generate 8 multiple-choice questions to test knowledge of: ${topic}

Rules: varied difficulty, plausible distractors, clear explanations.
Respond ONLY with JSON array, no markdown:
[{"question":"?","options":{"A":"","B":"","C":"","D":""},"answer":"B","explanation":"One sentence."}]`);
      setCustomQuestions(JSON.parse(raw));
      setScreen("quiz");
    } catch { setError("Failed to generate. Please try again."); }
    finally { setLoading(false); }
  };

  const generateITQuiz = async (catId) => {
    const cat = IT_CATEGORIES.find(c => c.id === catId);
    setItCategory(catId);
    setLoading(true); setError("");
    try {
      const raw = await callClaude(`Generate 8 multiple-choice IT quiz questions for: ${cat.label} — ${cat.desc}

Difficulty: ${IT_DIFFICULTY[itDifficulty]}
Rules: specific and technical, all 4 options plausible, varied sub-topics, explanations that teach.
Respond ONLY with JSON array, no markdown:
[{"question":"?","options":{"A":"","B":"","C":"","D":""},"answer":"A","explanation":"One clear sentence."}]`);
      setItQuestions(JSON.parse(raw));
      setScreen("quiz");
    } catch { setError("Failed to generate. Please try again."); setItCategory(null); }
    finally { setLoading(false); }
  };

  const diffBtn = (d, current, setter) => (
    <button key={d} onClick={() => setter(d)} style={{
      padding: "7px 16px", borderRadius: 8, cursor: "pointer",
      fontFamily: "monospace", fontSize: 12, letterSpacing: 1,
      border: current === d ? `1.5px solid ${DIFFICULTY_CONFIG[d].color}` : "1.5px solid #334155",
      background: current === d ? `${DIFFICULTY_CONFIG[d].color}18` : "transparent",
      color: current === d ? DIFFICULTY_CONFIG[d].color : "#475569",
      transition: "all 0.2s",
    }}>{DIFFICULTY_CONFIG[d].label}</button>
  );

  const currentCat = IT_CATEGORIES.find(c => c.id === itCategory);

  return (
    <div style={{ minHeight: "100vh", background: "#020c14", fontFamily: "'Inter',system-ui,sans-serif", color: "#f1f5f9", padding: "36px 20px 60px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ display: "inline-block", fontFamily: "monospace", fontSize: 11, letterSpacing: 4, color: "#22d3ee", textTransform: "uppercase", marginBottom: 10, padding: "4px 14px", border: "1px solid #22d3ee33", borderRadius: 20, background: "#22d3ee0a" }}>Study Assistant</div>
        <h1 style={{ fontSize: "clamp(24px,5vw,42px)", fontWeight: 800, margin: "0 0 8px", background: "linear-gradient(90deg,#f1f5f9 30%,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: -1 }}>
          AI Flashcard Generator
        </h1>
        <p style={{ color: "#64748b", fontSize: 14, margin: 0 }}>Flashcards with progress tracking · Custom quizzes · IT knowledge tests</p>
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 36, flexWrap: "wrap" }}>
        {[[MODE_FLASHCARD, "⚡ Flashcards"], [MODE_QUIZ, "🎯 Custom Quiz"], [MODE_IT, "🖥️ IT Quiz"]].map(([m, l]) => (
          <button key={m} onClick={() => switchMode(m)} style={{ padding: "10px 22px", borderRadius: 12, cursor: "pointer", fontFamily: "'Inter',system-ui,sans-serif", fontWeight: 600, fontSize: 14, border: mode === m ? "1.5px solid #22d3ee" : "1.5px solid #1e293b", background: mode === m ? "#22d3ee18" : "#0f172a", color: mode === m ? "#22d3ee" : "#475569", transition: "all 0.2s" }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto" }}>

        {/* ══ FLASHCARD MODE ══ */}
        {mode === MODE_FLASHCARD && screen === "input" && (
          <div style={{ background: "#0f172a", border: "1.5px solid #1e293b", borderRadius: 20, padding: "30px", boxShadow: "0 4px 30px #00000050" }}>
            <label style={{ display: "block", fontFamily: "monospace", fontSize: 11, color: "#22d3ee", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Study Material</label>
            <textarea value={studyText} onChange={e => setStudyText(e.target.value)}
              placeholder="Paste your notes, textbook excerpt, or any text..." rows={7}
              style={{ width: "100%", background: "#020c14", border: "1.5px solid #1e293b", borderRadius: 12, padding: "14px 16px", color: "#cbd5e1", fontFamily: "'Inter',system-ui,sans-serif", fontSize: 14, lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
            <div style={{ margin: "20px 0 24px" }}>
              <label style={{ display: "block", fontFamily: "monospace", fontSize: 11, color: "#22d3ee", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Difficulty</label>
              <div style={{ display: "flex", gap: 8 }}>{["easy","medium","hard"].map(d => diffBtn(d, fcDifficulty, setFcDifficulty))}</div>
              <p style={{ margin: "6px 0 0", fontFamily: "monospace", fontSize: 11, color: "#475569" }}>{DIFFICULTY_CONFIG[fcDifficulty].desc}</p>
            </div>
            <Btn onClick={generateFlashcards} disabled={loading} style={{ width: "100%" }}>
              {loading ? "Generating flashcards..." : "Generate Flashcards →"}
            </Btn>
            {error && <p style={{ marginTop: 14, color: "#f87171", fontFamily: "monospace", fontSize: 12, textAlign: "center" }}>⚠ {error}</p>}
          </div>
        )}

        {mode === MODE_FLASHCARD && screen === "deck" && cards.length > 0 && (
          <FlashcardDeck cards={cards} onReset={() => { setScreen("input"); setCards([]); }} />
        )}

        {/* ══ CUSTOM QUIZ MODE ══ */}
        {mode === MODE_QUIZ && screen === "input" && (
          <div style={{ background: "#0f172a", border: "1.5px solid #1e293b", borderRadius: 20, padding: "30px", boxShadow: "0 4px 30px #00000050" }}>
            <label style={{ display: "block", fontFamily: "monospace", fontSize: 11, color: "#22d3ee", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Topic</label>
            <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === "Enter" && generateCustomQuiz()}
              placeholder="e.g. Python dictionaries, World War II, Photosynthesis..."
              style={{ width: "100%", background: "#020c14", border: "1.5px solid #1e293b", borderRadius: 12, padding: "14px 16px", color: "#cbd5e1", fontFamily: "'Inter',system-ui,sans-serif", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
            <div style={{ marginTop: 10, padding: "12px 16px", background: "#0a1628", border: "1px solid #1e293b", borderRadius: 10 }}>
              <p style={{ margin: 0, fontFamily: "monospace", fontSize: 11, color: "#475569" }}>⏱ {TIMER_SECONDS}s per question · 8 questions · shuffled order · review screen after</p>
            </div>
            <div style={{ marginTop: 16 }}>
              <Btn onClick={generateCustomQuiz} disabled={loading}>{loading ? "Generating quiz..." : "Start Quiz →"}</Btn>
            </div>
            {error && <p style={{ marginTop: 14, color: "#f87171", fontFamily: "monospace", fontSize: 12, textAlign: "center" }}>⚠ {error}</p>}
          </div>
        )}

        {mode === MODE_QUIZ && screen === "quiz" && customQuestions.length > 0 && (
          <QuizRunner questions={customQuestions} title={topic || "Custom Quiz"} onBack={() => { setScreen("input"); setCustomQuestions([]); }} />
        )}

        {/* ══ IT QUIZ MODE ══ */}
        {mode === MODE_IT && screen === "input" && !loading && (
          <div>
            <div style={{ background: "#0f172a", border: "1.5px solid #1e293b", borderRadius: 16, padding: "18px 22px", marginBottom: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#22d3ee", letterSpacing: 2, textTransform: "uppercase" }}>Difficulty</span>
                  <p style={{ margin: "3px 0 0", fontFamily: "monospace", fontSize: 11, color: "#475569" }}>{IT_DIFFICULTY[itDifficulty]}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>{["easy","medium","hard"].map(d => diffBtn(d, itDifficulty, setItDifficulty))}</div>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <Tag color="#22d3ee">Choose a Category</Tag>
              <p style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", margin: "6px 0 0" }}>⏱ {TIMER_SECONDS}s per question · 8 questions · shuffled · review after</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 12 }}>
              {IT_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => generateITQuiz(cat.id)} style={{
                  background: "#0f172a", border: "1.5px solid #1e293b", borderRadius: 14,
                  padding: "18px 20px", cursor: "pointer", textAlign: "left",
                  transition: "border-color 0.2s, background 0.2s", display: "flex", flexDirection: "column", gap: 5,
                }}>
                  <span style={{ fontSize: 24 }}>{cat.icon}</span>
                  <span style={{ fontFamily: "'Inter',system-ui,sans-serif", fontWeight: 700, fontSize: 14, color: "#f1f5f9" }}>{cat.label}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11, color: "#475569", lineHeight: 1.4 }}>{cat.desc}</span>
                </button>
              ))}
            </div>
            {error && <p style={{ marginTop: 16, color: "#f87171", fontFamily: "monospace", fontSize: 12, textAlign: "center" }}>⚠ {error}</p>}
          </div>
        )}

        {/* IT loading */}
        {mode === MODE_IT && loading && (
          <div style={{ textAlign: "center", padding: "70px 0" }}>
            <div style={{ fontSize: 42, marginBottom: 14 }}>{currentCat?.icon ?? "🖥️"}</div>
            <Tag color="#22d3ee">Generating {currentCat?.label ?? "IT"} Quiz…</Tag>
            <p style={{ color: "#475569", fontSize: 13, marginTop: 10 }}>8 questions · {itDifficulty} difficulty</p>
          </div>
        )}

        {mode === MODE_IT && screen === "quiz" && itQuestions.length > 0 && (
          <QuizRunner questions={itQuestions} title={`${currentCat?.icon} ${currentCat?.label}`}
            onBack={() => { setScreen("input"); setItQuestions([]); setItCategory(null); }} />
        )}

      </div>
    </div>
  );
}
