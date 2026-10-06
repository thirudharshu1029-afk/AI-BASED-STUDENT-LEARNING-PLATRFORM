import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  FlaskConical,
  GraduationCap,
  Home,
  Menu,
  MessageCircle,
  NotebookPen,
  Plus,
  Search,
  Send,
  Sparkles,
  Target,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  createNote,
  createTask,
  deleteNote,
  deleteTask,
  getDashboard,
  getCurrentUser,
  getNotes,
  getTutorMessages,
  logout as logoutRequest,
  sendTutorMessage,
  updateCourseProgress,
  updateTask,
  type Course,
  type StudyMessage,
  type StudyNote,
  type StudyTask,
  type User,
} from './api'
import AuthPage from './AuthPage'
import './App.css'

const navItems: { label: string; icon: LucideIcon }[] = [
  { label: 'Home', icon: Home },
  { label: 'My learning', icon: BookOpen },
  { label: 'AI tutor', icon: MessageCircle },
  { label: 'My notes', icon: NotebookPen },
]

const quickPrompts = ['Explain it simply', 'Give me a practice question']
const courseIcons: Record<string, LucideIcon> = { Target, FlaskConical, Sparkles }
const todayLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' })
  .format(new Date())
  .toUpperCase()

function readAuthAction() {
  const params = new URLSearchParams(window.location.search)
  const mode = params.get('mode')
  const token = params.get('token') || ''
  if (token && mode === 'reset') return { mode: 'reset' as const, token }
  if (token && mode === 'verify') return { mode: 'verify' as const, token }
  return null
}

function App() {
  const [authAction, setAuthAction] = useState(readAuthAction)
  const [user, setUser] = useState<User | null>(null)
  const [verificationUrl, setVerificationUrl] = useState('')
  const [isCheckingSession, setIsCheckingSession] = useState(() => authAction === null)
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    let isCurrent = true
    getCurrentUser()
      .then(({ user: currentUser }) => { if (isCurrent) setUser(currentUser) })
      .catch((error: unknown) => {
        if (isCurrent) setAuthError(error instanceof Error ? error.message : 'Could not reach the sign-in service.')
      })
      .finally(() => { if (isCurrent) setIsCheckingSession(false) })
    return () => { isCurrent = false }
  }, [])

  async function signOut() {
    try {
      await logoutRequest()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not sign out.')
    } finally {
      setUser(null)
      setAuthAction(null)
      setVerificationUrl('')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }

  function finishAuthentication(nextUser: User, nextVerificationUrl = '') {
    setAuthAction(null)
    setUser(nextUser)
    setVerificationUrl(nextVerificationUrl)
    window.history.replaceState(null, '', window.location.pathname)
  }

  if (isCheckingSession) {
    return <main className="auth-loading"><span className="brand-mark"><GraduationCap size={20} /></span><p>Opening your learning space…</p></main>
  }
  if (!user || authAction) return <AuthPage onAuthenticated={finishAuthentication} initialError={authError} initialMode={authAction?.mode} token={authAction?.token} />
  return <LearningPlatform user={user} verificationUrl={verificationUrl} onLogout={() => void signOut()} />
}

function LearningPlatform({ user, verificationUrl, onLogout }: { user: User; verificationUrl: string; onLogout: () => void }) {
  const [activeNav, setActiveNav] = useState('Home')
  const [activeFilter, setActiveFilter] = useState('All subjects')
  const [tutorSubject, setTutorSubject] = useState('Mathematics')
  const [search, setSearch] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [tasks, setTasks] = useState<StudyTask[]>([])
  const [notes, setNotes] = useState<StudyNote[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [taskDraft, setTaskDraft] = useState('')
  const [taskComposerOpen, setTaskComposerOpen] = useState(false)
  const [noteComposerOpen, setNoteComposerOpen] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteSubject, setNoteSubject] = useState('Mathematics')
  const [noteContent, setNoteContent] = useState('')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [message, setMessage] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [chat, setChat] = useState<StudyMessage[]>([])

  useEffect(() => {
    let isCurrent = true
    getDashboard()
      .then((dashboard) => {
        if (!isCurrent) return
        setCourses(dashboard.courses)
        setTasks(dashboard.tasks)
        setApiError('')
      })
      .catch((error: unknown) => {
        if (isCurrent) setApiError(error instanceof Error ? error.message : 'Could not load saved data.')
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })
    return () => { isCurrent = false }
  }, [])

  useEffect(() => {
    let isCurrent = true
    getTutorMessages(tutorSubject)
      .then((messages) => { if (isCurrent) setChat(messages) })
      .catch((error: unknown) => { if (isCurrent) setApiError(error instanceof Error ? error.message : 'Could not load tutor history.') })
    return () => { isCurrent = false }
  }, [tutorSubject])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('[aria-label="Search lessons"]')?.focus()
      }
      if (event.key === 'Escape') {
        setNotificationsOpen(false)
        setProfileOpen(false)
        setWorkspaceOpen(false)
        setSelectedCourse(null)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    if (activeNav !== 'My notes') return
    getNotes()
      .then(setNotes)
      .catch((error: unknown) => setApiError(error instanceof Error ? error.message : 'Could not load notes.'))
  }, [activeNav])

  const filteredCourses = courses.filter((course) => {
    const matchesSubject = activeFilter === 'All subjects' || course.subject === activeFilter
    const matchesSearch = `${course.title} ${course.subject} ${course.lesson}`
      .toLowerCase()
      .includes(search.toLowerCase())
    return matchesSubject && matchesSearch
  })

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const question = message.trim()
    if (!question) return
    setMessage('')
    setIsSendingMessage(true)
    try {
      setChat(await sendTutorMessage(question, tutorSubject))
      setApiError('')
    } catch (error) {
      setMessage(question)
      setApiError(error instanceof Error ? error.message : 'Could not send the message.')
    } finally {
      setIsSendingMessage(false)
    }
  }

  async function toggleTask(task: StudyTask) {
    try {
      const updated = await updateTask(task._id, !task.completed)
      setTasks((current) => current.map((item) => item._id === updated._id ? updated : item))
      setApiError('')
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not update the task.')
    }
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = taskDraft.trim()
    if (!title) return
    try {
      const task = await createTask(title)
      setTasks((current) => [...current, task])
      setTaskDraft('')
      setTaskComposerOpen(false)
      setApiError('')
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not save the task.')
    }
  }

  async function removeTask(task: StudyTask) {
    try {
      await deleteTask(task._id)
      setTasks((current) => current.filter((item) => item._id !== task._id))
      setApiError('')
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not delete the task.')
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = noteTitle.trim()
    if (!title) return
    try {
      const note = await createNote({
        title,
        subject: noteSubject,
        content: noteContent.trim(),
        tag: noteSubject === 'Personal' ? 'PERSONAL' : noteSubject.toUpperCase(),
      })
      setNotes((current) => [note, ...current])
      setNoteTitle('')
      setNoteContent('')
      setNoteComposerOpen(false)
      setApiError('')
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not create the note.')
    }
  }

  async function removeNote(note: StudyNote) {
    try {
      await deleteNote(note._id)
      setNotes((current) => current.filter((item) => item._id !== note._id))
      setApiError('')
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not delete the note.')
    }
  }

  async function startLesson() {
    if (!selectedCourse) return
    try {
      const updated = await updateCourseProgress(
        selectedCourse._id,
        Math.min(selectedCourse.progress + 1, 100),
      )
      setCourses((current) => current.map((course) => course._id === updated._id ? updated : course))
      setTutorSubject(updated.subject)
      setSelectedCourse(null)
      setActiveNav('AI tutor')
      setApiError('')
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Could not update lesson progress.')
    }
  }

  const isTutor = activeNav === 'AI tutor'
  const completedTaskCount = tasks.filter((task) => task.completed).length
  const pageTitle = isTutor
    ? 'Your study buddy, on call.'
    : activeNav === 'My notes'
      ? 'A place for the big ideas.'
      : activeNav === 'My learning'
        ? 'Your learning, in motion.'
        : 'A good day to learn, Maya.'

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#home" onClick={() => setActiveNav('Home')}>
          <span className="brand-mark"><GraduationCap size={20} strokeWidth={2.2} /></span>
          <span>orbit<span className="brand-period">.</span></span>
        </a>

        <button className="school-switcher" aria-expanded={workspaceOpen} onClick={() => setWorkspaceOpen((open) => !open)}>
          <span className="school-avatar">M</span>
          <span className="school-copy"><strong>{user.displayName.split(' ')[0]}’s space</strong><small>Personal learning</small></span>
          <ChevronDown size={16} />
        </button>
        {workspaceOpen && <div className="workspace-menu"><strong>Maya’s learning space</strong><span>Personalized courses and saved notes for Year 11.</span><button onClick={() => { setWorkspaceOpen(false); setActiveNav('My learning') }}>Open learning path <ArrowRight size={14} /></button></div>}

        <p className="nav-caption">YOUR SPACE</p>
        <nav className="primary-nav" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              className={`nav-link ${activeNav === label ? 'nav-link-active' : ''}`}
              key={label}
              onClick={() => {
                setActiveNav(label)
                setMobileNavOpen(false)
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === 'AI tutor' && <span className="nav-new">NEW</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="streak-card">
            <span className="streak-icon">✳</span>
            <div><strong>4 day streak</strong><span>You’re finding your rhythm.</span></div>
            <span className="streak-count">04</span>
          </div>
          <button className="profile-row" onClick={() => setProfileOpen((open) => !open)}>
            <span className="profile-avatar">{getInitials(user.displayName)}</span>
            <span className="profile-copy"><strong>{user.displayName}</strong><small>Personal space</small></span>
            <span className="profile-menu">···</span>
          </button>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>My space</span><span className="breadcrumb-slash">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search size={17} />
              <input aria-label="Search lessons" placeholder="Search anything..." value={search} onChange={(event) => setSearch(event.target.value)} />
              <kbd>⌘ K</kbd>
            </label>
              <div className="top-action-wrap">
                <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => { setNotificationsOpen((open) => !open); setProfileOpen(false) }}><Bell size={18} /><i /></button>
                {notificationsOpen && <div className="top-popover notification-popover"><strong>Today’s reminders</strong>{tasks.filter((task) => !task.completed).length > 0 ? tasks.filter((task) => !task.completed).slice(0, 3).map((task) => <button key={task._id} onClick={() => { setNotificationsOpen(false); void toggleTask(task) }}><span>{task.title}</span><small>{task.detail} · Mark complete</small></button>) : <p>You’re all caught up. Nice work.</p>}</div>}
              </div>
              <div className="top-action-wrap">
                <button className="top-avatar" aria-label="Open profile" aria-expanded={profileOpen} onClick={() => { setProfileOpen((open) => !open); setNotificationsOpen(false) }}>{getInitials(user.displayName)}</button>
                {profileOpen && <div className="top-popover profile-popover"><strong>{user.displayName}</strong><small>{user.email}</small><button onClick={() => { setProfileOpen(false); setActiveNav('My learning') }}>My learning <ArrowRight size={14} /></button><button onClick={() => { setProfileOpen(false); setActiveNav('My notes') }}>My notes <ArrowRight size={14} /></button><button onClick={onLogout}>Sign out <ArrowRight size={14} /></button></div>}
              </div>
            </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> {todayLabel}</div>
              <h1>{pageTitle.replace('Maya', user.displayName.split(' ')[0])}</h1>
              <p className="welcome-subtitle">Little by little, a little becomes a lot.</p>
            </div>
            <button className="outline-button" onClick={() => setActiveNav('AI tutor')}><Sparkles size={16} /> Ask your AI tutor</button>
          </section>

          {!user.emailVerified && <div className="api-status">Your email is not verified yet.{verificationUrl && <> <a href={verificationUrl}>Verify it now</a></>}</div>}

          {(isLoading || apiError) && <div className={`api-status ${apiError ? 'api-status-error' : ''}`} role="status">{apiError ? `Could not sync your learning space: ${apiError}` : 'Connecting to your learning space…'}</div>}

          {isTutor ? (
            <section className="tutor-page">
              <div className="tutor-heading"><span className="tutor-orb"><Sparkles size={21} /></span><div><span className="eyebrow">ORBIT AI · {tutorSubject.toUpperCase()}</span><h2>Curiosity looks good on you.</h2><p>No silly questions here. Start anywhere.</p></div><label className="tutor-subject-picker">LESSON<select aria-label="Tutor subject" value={tutorSubject} onChange={(event) => setTutorSubject(event.target.value)}>{courses.map((course) => <option key={course._id} value={course.subject}>{course.subject}</option>)}</select></label></div>
              <ChatMessages messages={chat} />
              <ChatComposer message={message} setMessage={setMessage} onSubmit={sendMessage} isSending={isSendingMessage} />
            </section>
          ) : activeNav === 'My notes' ? (
            <NotesView
              notes={notes}
              composerOpen={noteComposerOpen}
              title={noteTitle}
              subject={noteSubject}
              content={noteContent}
              setTitle={setNoteTitle}
              setSubject={setNoteSubject}
              setContent={setNoteContent}
              onAdd={() => setNoteComposerOpen(true)}
              onCancel={() => setNoteComposerOpen(false)}
              onSubmit={addNote}
              onDelete={removeNote}
            />
          ) : (
            <>
              <section className="hero-grid">
                <div className="continue-card">
                  <div className="continue-copy">
                    <div className="eyebrow light-eyebrow"><span className="live-dot" /> PICK UP WHERE YOU LEFT OFF</div>
                    <span className="course-kicker">MATHEMATICS <span>·</span> UNIT 04</span>
                    <h2>Probability,<br />without the guesswork.</h2>
                    <p>There’s more than one way to find the answer.</p>
                    <button className="continue-button" disabled={!courses[0]} onClick={() => courses[0] && setSelectedCourse(courses[0])}>Continue learning <ArrowRight size={16} /></button>
                    <div className="lesson-progress"><div className="progress-track"><span style={{ width: `${courses[0]?.progress ?? 0}%` }} /></div><span>{courses[0]?.progress ?? 0}% complete</span></div>
                  </div>
                  <div className="continue-image" role="img" aria-label="An open mathematics notebook" />
                  <span className="hero-index">01 <span>/ 03</span></span>
                </div>

                <aside className="focus-card">
                  <div className="focus-top"><span className="focus-icon"><Sparkles size={18} /></span><span className="focus-label">YOUR AI STUDY BUDDY</span><span className="online-dot" /></div>
                  <p className="focus-question">What’s on your mind?</p>
                  <p className="focus-copy">From tricky equations to “wait, why?” moments. Let’s work it out.</p>
                  <div className="prompt-list">{quickPrompts.map((prompt) => <button key={prompt} onClick={() => { setActiveNav('AI tutor'); setMessage(prompt) }}>{prompt}<ArrowUpRight size={14} /></button>)}</div>
                  <button className="tutor-link" onClick={() => setActiveNav('AI tutor')}>Open your AI tutor <ArrowRight size={15} /></button>
                  <div className="focus-doodle" aria-hidden="true">✳</div>
                </aside>
              </section>

              <section className="stats-row" aria-label="Learning overview">
                <div className="stat-item"><span className="stat-icon stat-icon-coral"><Clock3 size={17} /></span><div><strong>2.4 <small>hrs</small></strong><span>Study time this week</span></div><span className="stat-change">+18%</span></div>
                <div className="stat-divider" />
                <div className="stat-item"><span className="stat-icon stat-icon-blue"><Target size={17} /></span><div><strong>{completedTaskCount}<small>/ {tasks.length}</small></strong><span>Daily goals checked off</span></div><span className="stat-change stat-change-neutral">Today</span></div>
                <div className="stat-divider" />
                <div className="week-chart"><div className="week-chart-label"><span>THIS WEEK</span><strong>4h 20m</strong></div><div className="bar-chart">{[36, 65, 48, 86, 54, 30, 18].map((height, index) => <div className="bar-column" key={index}><span className={index === 3 ? 'bar-today' : ''} style={{ height: `${height}%` }} /><small>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</small></div>)}</div></div>
              </section>

              <div className="lower-grid">
                <section className="courses-section">
                  <div className="section-heading"><div><span className="eyebrow">YOUR PERSONALIZED PATH</span><h2>{activeNav === 'My learning' ? 'All your learning' : 'Keep the momentum'}</h2></div><button className="text-link" onClick={() => setActiveNav('My learning')}>View all <ArrowRight size={15} /></button></div>
                  <div className="course-toolbar"><div className="filter-tabs">{['All subjects', 'Mathematics', 'Biology', 'Physics'].map((filter) => <button key={filter} className={activeFilter === filter ? 'filter-active' : ''} onClick={() => setActiveFilter(filter)}>{filter}</button>)}</div><span className="course-count">{filteredCourses.length} COURSES</span></div>
                  <div className="course-list">{filteredCourses.length > 0 ? filteredCourses.map((course) => <CourseRow key={course._id} course={course} onClick={() => setSelectedCourse(course)} />) : <div className="empty-results">{isLoading ? 'Loading your courses…' : `No lessons match “${search}”. Try another search.`}</div>}</div>
                </section>

                <aside className="tasks-section">
                  <div className="section-heading task-heading"><div><span className="eyebrow">A LITTLE GOES A LONG WAY</span><h2>Today’s intentions</h2></div><span className="task-count">{completedTaskCount}/{tasks.length}</span></div>
                  <div className="task-list">{tasks.map((task) => <div className={`task-row ${task.completed ? 'task-complete' : ''}`} key={task._id}><button className="task-toggle" aria-label={`${task.completed ? 'Mark incomplete' : 'Mark complete'}: ${task.title}`} onClick={() => void toggleTask(task)}><span className="task-check">{task.completed && <Check size={13} />}</span></button><span className="task-copy"><strong>{task.title}</strong><small>{task.detail}</small></span><button className="task-delete" aria-label={`Delete ${task.title}`} onClick={() => void removeTask(task)}><X size={14} /></button></div>)}</div>
                  {taskComposerOpen && <form className="task-composer" onSubmit={addTask}><input aria-label="New intention" placeholder="What would you like to do?" value={taskDraft} onChange={(event) => setTaskDraft(event.target.value)} /><button type="submit" aria-label="Save intention"><Check size={15} /></button></form>}
                  <button className="add-task-button" onClick={() => setTaskComposerOpen((open) => !open)}><Plus size={15} /> {taskComposerOpen ? 'Close' : 'Add an intention'}</button>
                  <div className="task-footer"><span>YOUR PACE, YOUR RULES</span><span className="sun-mark">✳</span></div>
                </aside>
              </div>
            </>
          )}
          <footer className="page-footer"><span>Made for curious minds.</span><span>Take it one step at a time <span className="footer-sparkle">✳</span></span></footer>
        </div>
      </main>

      {selectedCourse && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedCourse(null) }}><section className="lesson-modal" role="dialog" aria-modal="true" aria-labelledby="lesson-title"><button className="modal-close icon-button" aria-label="Close lesson" onClick={() => setSelectedCourse(null)}><X size={18} /></button><div className={`modal-image ${selectedCourse.tone}`} style={{ backgroundImage: `url("${selectedCourse.image}")` }} /><span className="eyebrow">{selectedCourse.subject.toUpperCase()} · YOUR NEXT LESSON</span><h2 id="lesson-title">{selectedCourse.title}</h2><p>{selectedCourse.lesson}. Pick up right where you left off, or ask your tutor to walk through the tricky bits with you.</p><div className="modal-progress"><div className="progress-track"><span style={{ width: `${selectedCourse.progress}%` }} /></div><span>{selectedCourse.progress}% complete</span></div><button className="modal-primary" onClick={() => void startLesson()}>Start this lesson <ArrowRight size={16} /></button></section></div>}
    </div>
  )
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
}

function CourseRow({ course, onClick }: { course: Course; onClick: () => void }) {
  const Icon = courseIcons[course.icon] ?? BookOpen
  return <article className="course-row"><div className={`course-thumb ${course.tone}`} style={{ backgroundImage: `url("${course.image}")` }}><span><Icon size={16} /></span></div><div className="course-info"><span className="course-subject">{course.subject}</span><h3>{course.title}</h3><span className="course-lesson">{course.lesson}</span></div><div className="course-progress"><div className="course-progress-track"><span style={{ width: `${course.progress}%` }} /></div><span>{course.progress}%</span></div><button className="course-open" aria-label={`Open ${course.title}`} onClick={onClick}><ArrowUpRight size={17} /></button></article>
}

function ChatMessages({ messages }: { messages: StudyMessage[] }) {
  const visibleMessages = messages.length > 0
    ? messages
    : [{ _id: 'welcome', role: 'tutor' as const, content: 'Hey Maya! What are we figuring out today?', createdAt: '' }]
  return <div className="chat-messages" aria-live="polite">{visibleMessages.map((item) => <div className={`chat-message chat-${item.role}`} key={item._id}><span className="chat-avatar">{item.role === 'tutor' ? <Sparkles size={15} /> : 'MC'}</span><p>{item.content}</p></div>)}</div>
}

function ChatComposer({ message, setMessage, onSubmit, isSending }: { message: string; setMessage: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; isSending: boolean }) {
  return <><div className="chat-prompts">{quickPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => setMessage(prompt)}>{prompt}</button>)}</div><form className="chat-composer" onSubmit={onSubmit}><input aria-label="Ask your AI tutor" placeholder="Ask me anything you’re learning..." value={message} onChange={(event) => setMessage(event.target.value)} /><button type="submit" aria-label="Send message" disabled={isSending || !message.trim()}>{isSending ? <span className="sending-indicator">...</span> : <Send size={17} />}</button></form><p className="tutor-disclaimer">Orbit is here to help you learn. Double-check important information with your teacher.</p></>
}

function NotesView({
  notes,
  composerOpen,
  title,
  subject,
  content,
  setTitle,
  setSubject,
  setContent,
  onAdd,
  onCancel,
  onSubmit,
  onDelete,
}: {
  notes: StudyNote[]
  composerOpen: boolean
  title: string
  subject: string
  content: string
  setTitle: (value: string) => void
  setSubject: (value: string) => void
  setContent: (value: string) => void
  onAdd: () => void
  onCancel: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onDelete: (note: StudyNote) => void
}) {
  return <section className="notes-page"><div className="section-heading"><div><span className="eyebrow">YOUR THINKING, COLLECTED</span><h2>Notes worth keeping</h2></div><button className="outline-button" onClick={onAdd}><Plus size={16} /> New note</button></div>{composerOpen && <form className="note-composer" onSubmit={onSubmit}><label>Title<input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Give this note a title" /></label><label>Subject<select value={subject} onChange={(event) => setSubject(event.target.value)}><option>Mathematics</option><option>Biology</option><option>Physics</option><option>Personal</option></select></label><label className="note-content-field">Your note<textarea maxLength={4000} rows={4} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Capture the idea while it’s fresh..." /></label><div className="note-composer-actions"><button className="text-link" type="button" onClick={onCancel}>Cancel</button><button className="modal-primary" type="submit">Save note</button></div></form>}<div className="note-grid">{notes.map((note, index) => <article className={`note-card ${index % 2 === 0 ? 'note-card-coral' : 'note-card-blue'}`} key={note._id}><button className="note-delete" aria-label={`Delete note ${note.title}`} onClick={() => onDelete(note)}><X size={14} /></button><span className="note-date">{new Date(note.createdAt).toLocaleDateString('en', { month: 'short', day: '2-digit' }).toUpperCase()} · {note.subject.toUpperCase()}</span><h3>{note.title}</h3><p>{note.content}</p><span className="note-tag">{note.tag}</span></article>)}</div></section>
}

export default App