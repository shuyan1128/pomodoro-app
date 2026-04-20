import { useState, useEffect, useRef } from 'react'

const WORK_SECONDS = 2 * 60
const BREAK_SECONDS = 5 * 60
const API = 'https://pomodoro-app-qi8p.onrender.com'

function playDing() {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4)
  gain.gain.setValueAtTime(0.4, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.8)
}

const EXERCISES = [
  '🧘 Neck rolls — slowly roll your neck side to side for 30 seconds',
  '🙆 Shoulder shrugs — raise shoulders to ears, hold 5s, release. Repeat 5x',
  '🤸 Standing forward fold — stand and reach toward your toes for 30 seconds',
  '👀 Eye rest — close your eyes and cup them with your palms for 1 minute',
  '💪 Wrist circles — rotate both wrists 10x each direction',
  '🚶 Walk around — stand up and take 20 steps anywhere',
  '🌬️ Deep breathing — inhale 4s, hold 4s, exhale 4s. Repeat 4x',
]

function pickExercises() {
  const shuffled = [...EXERCISES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}

interface Task {
  id: number
  text: string
  completed: boolean
}

export default function App() {
  const [mode, setMode] = useState<'focus' | 'break'>('focus')
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS)
  const [running, setRunning] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [dailyTasks, setDailyTasks] = useState<Task[]>([])
  const [dailyInput, setDailyInput] = useState('')
  const [dailyAdding, setDailyAdding] = useState(false)
  const [dragOverFocus, setDragOverFocus] = useState(false)
  const [exercises, setExercises] = useState<string[]>([])
  const secondsRef = useRef(WORK_SECONDS)
  const modeRef = useRef<'focus' | 'break'>('focus')
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    const savedStartTime = localStorage.getItem('pomodoro_startTime')
    const savedMode = localStorage.getItem('pomodoro_mode') as 'focus' | 'break' | null
    if (savedStartTime && savedMode) {
      const startTime = Number(savedStartTime)
      const totalSeconds = savedMode === 'focus' ? WORK_SECONDS : BREAK_SECONDS
      const remaining = totalSeconds - Math.floor((Date.now() - startTime) / 1000)
      if (remaining > 0) {
        modeRef.current = savedMode
        secondsRef.current = remaining
        setMode(savedMode)
        setSecondsLeft(remaining)
        setRunning(true)
      } else {
        localStorage.removeItem('pomodoro_startTime')
        localStorage.removeItem('pomodoro_mode')
        const nextMode = savedMode === 'focus' ? 'break' : 'focus'
        const nextSeconds = nextMode === 'focus' ? WORK_SECONDS : BREAK_SECONDS
        modeRef.current = nextMode
        secondsRef.current = nextSeconds
        setMode(nextMode)
        setSecondsLeft(nextSeconds)
        if (nextMode === 'break') setExercises(pickExercises())
      }
    }
  }, [])

  useEffect(() => {
    fetch(`${API}/tasks`)
      .then(r => r.json())
      .then((data: Omit<Task, 'completed'>[]) =>
        setTasks(data.map(t => ({ ...t, completed: false })))
      )
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`${API}/daily-tasks`)
      .then(r => r.json())
      .then((data: Omit<Task, 'completed'>[]) =>
        setDailyTasks(data.map(t => ({ ...t, completed: false })))
      )
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!running) return
    const totalSeconds = modeRef.current === 'focus' ? WORK_SECONDS : BREAK_SECONDS
    startTimeRef.current = Date.now() - (totalSeconds - secondsRef.current) * 1000
    localStorage.setItem('pomodoro_startTime', String(startTimeRef.current))
    localStorage.setItem('pomodoro_mode', modeRef.current)

    const id = setInterval(() => {
      const next = totalSeconds - Math.floor((Date.now() - startTimeRef.current) / 1000)
      if (next <= 0) {
        clearInterval(id)
        localStorage.removeItem('pomodoro_startTime')
        localStorage.removeItem('pomodoro_mode')
        playDing()
        const nextMode = modeRef.current === 'focus' ? 'break' : 'focus'
        const nextSeconds = nextMode === 'focus' ? WORK_SECONDS : BREAK_SECONDS
        modeRef.current = nextMode
        secondsRef.current = nextSeconds
        setMode(nextMode)
        setSecondsLeft(nextSeconds)
        if (nextMode === 'break') setExercises(pickExercises())
        setRunning(false)
      } else {
        secondsRef.current = next
        setSecondsLeft(next)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [running])

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const seconds = String(secondsLeft % 60).padStart(2, '0')

  function toggleRunning() {
    setRunning(r => {
      if (r) {
        localStorage.removeItem('pomodoro_startTime')
        localStorage.removeItem('pomodoro_mode')
      }
      return !r
    })
  }

  function reset() {
    localStorage.removeItem('pomodoro_startTime')
    localStorage.removeItem('pomodoro_mode')
    setRunning(false)
    setMode('focus')
    modeRef.current = 'focus'
    secondsRef.current = WORK_SECONDS
    setSecondsLeft(WORK_SECONDS)
  }

  async function addTask() {
    const text = input.trim()
    if (!text || adding) return
    setAdding(true)
    try {
      const res = await fetch(`${API}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const task: Task = { ...(await res.json()), completed: false }
      setTasks(t => [...t, task])
      setInput('')
    } catch {
      // backend unreachable — silently ignore
    } finally {
      setAdding(false)
    }
  }

  function toggleTask(id: number) {
    setTasks(t => t.map(task => task.id === id ? { ...task, completed: !task.completed } : task))
  }

  async function deleteTask(id: number) {
    setTasks(t => t.filter(task => task.id !== id))
    try {
      await fetch(`${API}/tasks/${id}`, { method: 'DELETE' })
    } catch {
      // backend unreachable
    }
  }

  async function addDailyTask() {
    const text = dailyInput.trim()
    if (!text || dailyAdding) return
    setDailyAdding(true)
    try {
      const res = await fetch(`${API}/daily-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const task: Task = { ...(await res.json()), completed: false }
      setDailyTasks(t => [...t, task])
      setDailyInput('')
    } catch {
      // backend unreachable
    } finally {
      setDailyAdding(false)
    }
  }

  async function deleteDailyTask(id: number) {
    setDailyTasks(t => t.filter(task => task.id !== id))
    try {
      await fetch(`${API}/daily-tasks/${id}`, { method: 'DELETE' })
    } catch {
      // backend unreachable
    }
  }

  async function dropOnFocus(e: React.DragEvent) {
    e.preventDefault()
    setDragOverFocus(false)
    const id = Number(e.dataTransfer.getData('dailyTaskId'))
    const daily = dailyTasks.find(t => t.id === id)
    if (!daily) return
    setDailyTasks(dt => dt.filter(t => t.id !== id))
    try {
      const res = await fetch(`${API}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: daily.text }),
      })
      const newTask: Task = { ...(await res.json()), completed: false }
      setTasks(t => [...t, newTask])
      await fetch(`${API}/daily-tasks/${id}`, { method: 'DELETE' })
    } catch {
      setDailyTasks(dt => [...dt, daily])
    }
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>ysy's studio... 🫧 </h1>
      <p style={styles.subtitle}>there is always hope in the fog, you got this 🌸</p>

      {/* Timer */}
      <div style={styles.timerCard}>
        <div style={{ ...styles.modeLabel, color: mode === 'focus' ? '#35431d' : '#35431d' }}>
          {mode === 'focus' ? '🥥 Focus' : '💖 Break'}
        </div>
        <div style={styles.time}>{minutes}:{seconds}</div>
        <div style={styles.controls}>
          <button
            style={{ ...styles.btn, ...(running ? styles.btnSecondary : styles.btnPrimary) }}
            onClick={toggleRunning}
            disabled={secondsLeft === 0}
          >
            {running ? 'Pause' : 'Start'}
          </button>
          <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={reset}>
            Reset
          </button>
        </div>
      </div>

      {/* Stretch exercises (break only) */}
      {mode === 'break' && (
        <div style={{ ...styles.taskCard, marginBottom: 24 }}>
          <h2 style={styles.sectionTitle}>🧘 Stretch Break</h2>
          <ul style={styles.list}>
            {exercises.map((ex, i) => (
              <li key={i} style={{ ...styles.listItem, alignItems: 'flex-start' }}>
                <span style={{ ...styles.taskText, color: '#2c2c2c' }}>{ex}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Two-column task layout */}
      <div style={styles.columns}>
        {/* Focus tasks */}
        <div
          style={{ ...styles.taskCard, ...styles.column, ...(dragOverFocus ? styles.dropTarget : {}) }}
          onDragOver={e => { e.preventDefault(); setDragOverFocus(true) }}
          onDragLeave={() => setDragOverFocus(false)}
          onDrop={dropOnFocus}
        >
          <h2 style={styles.sectionTitle}>TO DOS 💪</h2>
          <div style={styles.inputRow}>
            <input
              style={styles.input}
              placeholder="Add a task..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
            />
            <button
              style={{ ...styles.btn, ...styles.btnPrimary, ...styles.addBtn, opacity: adding ? 0.6 : 1 }}
              onClick={addTask}
              disabled={adding}
            >
              {adding ? '…' : '+'}
            </button>
          </div>
          {tasks.length === 0 ? (
            <p style={styles.empty}>No tasks yet.</p>
          ) : (
            <ul style={styles.list}>
              {tasks.map(task => (
                <li key={task.id} style={styles.listItem}>
                  <button style={{ ...styles.checkBtn, color: task.completed ? '#617c34' : '#ccc' }} onClick={() => toggleTask(task.id)}>
                    ✓
                  </button>
                  <span style={{ ...styles.taskText, textDecoration: task.completed ? 'line-through' : 'none', color: task.completed ? '#aaa' : '#2c2c2c' }}>
                    {task.text}
                  </span>
                  <button style={styles.deleteBtn} onClick={() => deleteTask(task.id)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Daily tasks */}
        <div style={{ ...styles.taskCard, ...styles.column }}>
          <h2 style={styles.sectionTitle}>DAILY 🌿</h2>
          <div style={styles.inputRow}>
            <input
              style={styles.input}
              placeholder="Add a daily task..."
              value={dailyInput}
              onChange={e => setDailyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDailyTask()}
            />
            <button
              style={{ ...styles.btn, ...styles.btnPrimary, ...styles.addBtn, opacity: dailyAdding ? 0.6 : 1 }}
              onClick={addDailyTask}
              disabled={dailyAdding}
            >
              {dailyAdding ? '…' : '+'}
            </button>
          </div>
          {dailyTasks.length === 0 ? (
            <p style={styles.empty}>No daily tasks yet.</p>
          ) : (
            <ul style={styles.list}>
              {dailyTasks.map(task => (
                <li
                  key={task.id}
                  style={{ ...styles.listItem, cursor: 'grab' }}
                  draggable
                  onDragStart={e => e.dataTransfer.setData('dailyTaskId', String(task.id))}
                >
                  <span style={{ ...styles.taskText, color: '#2c2c2c' }}>{task.text}</span>
                  <button style={styles.deleteBtn} onClick={() => deleteDailyTask(task.id)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Spotify */}
      <div style={{ ...styles.taskCard, marginTop: 24 }}>
        <h2 style={styles.sectionTitle}> PLAYLIST 🎧</h2>
        <iframe
          src="https://open.spotify.com/embed/playlist/6l8DIixsHH1E868BKAgw3T"
          width="100%"
          height="160"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          style={{ border: 'none', borderRadius: 12, display: 'block' }}
        />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    width: '100%',
    boxSizing: 'border-box',
    background: '#f5f0eb',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '48px 16px',
    fontFamily: "'Josefin Sans', sans-serif",
  },
  title: {
    background: '#ffdcea',
    fontSize: 40,
    fontWeight: 700,
    color: '#374b1a',
    marginBottom: 6,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#303516',
    marginBottom: 32,
    marginTop: 20,
  },
  timerCard: {
    background: '#ffdcea', 
    borderRadius: 16,
    padding: '32px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    textAlign: 'center',
    width: '100%',
    maxWidth: 500,
    marginBottom: 24,
  },
  modeLabel: {
    fontSize: 25,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    marginBottom: 40,
  },
  time: {
    fontSize: 55,
    fontWeight: 300,
    color: '#2c2c2c',
    letterSpacing: 4,
    marginBottom: 40,
    fontVariantNumeric: 'tabular-nums',
  },
  controls: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
  },
  btn: {
    padding: '10px 24px',
    borderRadius: 8,
    border: 'none',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  btnPrimary: {
    background: '#617c34',
    color: '#fff',
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    fontSize: 20,
    padding: 0,
    flexShrink: 0,
  },
  btnSecondary: {
    background: '#e8f0d8',
    color: '#617c34',
  },
  columns: {
    display: 'flex',
    gap: 16,
    width: '100%',
    maxWidth: 560,
    alignItems: 'stretch',
  },
  column: {
    flex: 1,
    minWidth: 0,
    maxWidth: 'none',
    width: '100%',
  },
  taskCard: {
    background: '#f5f0e3',
    borderRadius: 16,
    padding: '28px 32px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    width: '100%',
    maxWidth: 560,
    boxSizing: 'border-box' as const,
    overflow: 'hidden',
  },
  dropTarget: {
    outline: '2px dashed #617c34',
    outlineOffset: -2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#2c2c2c',
    marginBottom: 16,
    marginTop: 0,
  },
  inputRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '10px 14px',
    borderRadius: 8,
    border: '0px solid #dcc5de',
    fontSize: 14,
    outline: 'none',
    background: '#fafafa',
    color: '#2c2c2c',
  },
  empty: {
    color: '#aaa',
    fontSize: 14,
    textAlign: 'center',
    margin: '12px 0 0',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#faf7f7',
    borderRadius: 8,
    border: '1px solid #f0e6e6',
  },
  taskText: {
    fontSize: 14,
    color: '#2c2c2c',
    flex: 1,
    textAlign: 'left',
  },
  checkBtn: {
    background: 'none',
    border: '1.5px solid currentColor',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: 12,
    width: 22,
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginRight: 10,
    padding: 0,
    transition: 'color 0.15s',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#9b6fa8',
    cursor: 'pointer',
    fontSize: 14,
    padding: '0 0 0 12px',
    opacity: 0.6,
  },
}
