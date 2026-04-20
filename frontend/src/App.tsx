import { useState, useEffect, useRef } from 'react'

const WORK_SECONDS = 25 * 60
const API = 'http://localhost:8080'

interface Task {
  id: number
  text: string
  completed: boolean
}

export default function App() {
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS)
  const [running, setRunning] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch(`${API}/tasks`)
      .then(r => r.json())
      .then((data: Omit<Task, 'completed'>[]) =>
        setTasks(data.map(t => ({ ...t, completed: false })))
      )
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            return 0
          }
          return s - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current!)
    }
    return () => clearInterval(intervalRef.current!)
  }, [running])

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const seconds = String(secondsLeft % 60).padStart(2, '0')
  const progress = (secondsLeft / WORK_SECONDS) * 100

  function reset() {
    setRunning(false)
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

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>YSY's Focus Time 🍅</h1>
      <p style={styles.subtitle}>take a breath, you got this ❤️</p>

      {/* Timer */}
      <div style={styles.timerCard}>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
        <div style={styles.time}>{minutes}:{seconds}</div>
        <div style={styles.controls}>
          <button
            style={{ ...styles.btn, ...(running ? styles.btnSecondary : styles.btnPrimary) }}
            onClick={() => setRunning(r => !r)}
            disabled={secondsLeft === 0}
          >
            {running ? 'Pause' : 'Start'}
          </button>
          <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={reset}>
            Reset
          </button>
        </div>
      </div>

      {/* Task list */}
      <div style={styles.taskCard}>
        <h2 style={styles.sectionTitle}>Tasks</h2>
        <div style={styles.inputRow}>
          <input
            style={styles.input}
            placeholder="Add a task..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
          />
          <button
            style={{ ...styles.btn, ...styles.btnPrimary, opacity: adding ? 0.6 : 1 }}
            onClick={addTask}
            disabled={adding}
          >
            {adding ? '…' : 'Add'}
          </button>
        </div>
        {tasks.length === 0 ? (
          <p style={styles.empty}>No tasks yet.</p>
        ) : (
          <ul style={styles.list}>
            {tasks.map(task => (
              <li key={task.id} style={styles.listItem}>
                <button style={{ ...styles.checkBtn, color: task.completed ? '#c0392b' : '#ccc' }} onClick={() => toggleTask(task.id)}>
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
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: '#c0392b',
    marginBottom: 6,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#303516',
    marginBottom: 32,
    marginTop: 0,
  },
  timerCard: {
    background: '#fff', 
    borderRadius: 16,
    padding: '32px 48px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    textAlign: 'center',
    width: '100%',
    maxWidth: 560,
    marginBottom: 24,
  },
  progressBar: {
    height: 6,
    background: '#f0e6e6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 24,
  },
  progressFill: {
    height: '100%',
    background: '#c0392b',
    borderRadius: 4,
    transition: 'width 1s linear',
  },
  time: {
    fontSize: 72,
    fontWeight: 300,
    color: '#2c2c2c',
    letterSpacing: 4,
    marginBottom: 28,
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
    background: '#c0392b',
    color: '#fff',
  },
  btnSecondary: {
    background: '#f0e6e6',
    color: '#c0392b',
  },
  taskCard: {
    background: '#fff',
    borderRadius: 16,
    padding: '28px 32px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    width: '100%',
    maxWidth: 560,
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
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1.5px solid #e0d4d4',
    fontSize: 14,
    outline: 'none',
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
    color: '#c0392b',
    cursor: 'pointer',
    fontSize: 14,
    padding: '0 0 0 12px',
    opacity: 0.6,
  },
}
