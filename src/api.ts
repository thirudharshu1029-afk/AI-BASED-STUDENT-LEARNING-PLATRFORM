export type Course = {
  _id: string
  title: string
  subject: string
  lesson: string
  progress: number
  image: string
  tone: string
  icon: string
  learningContent?: string
}

export type User = { id: string; displayName: string; email: string; emailVerified: boolean }

export type StudyTask = {
  _id: string
  title: string
  detail: string
  completed: boolean
}

export type StudyNote = {
  _id: string
  title: string
  subject: string
  content: string
  tag: string
  createdAt: string
}

export type StudyMessage = {
  _id: string
  role: 'student' | 'tutor'
  content: string
  createdAt: string
}

type Dashboard = {
  courses: Course[]
  tasks: StudyTask[]
  stats: { completedGoals: number; totalGoals: number }
}

type LocalAccount = { user: User; passwordHash: string }
type LocalDatabase = {
  accounts: LocalAccount[]
  currentUserId: string | null
  coursesByUser: Record<string, Course[]>
  tasksByUser: Record<string, StudyTask[]>
  notesByUser: Record<string, StudyNote[]>
  messagesByUser: Record<string, StudyMessage[]>
  resetTokens: Record<string, { userId: string; expiresAt: number }>
}

const storageKey = 'orbit-learning-local-v1'
const passwordIterations = 120_000
const encoder = new TextEncoder()

const starterCourses: Omit<Course, '_id'>[] = [
  {
    title: 'The language of numbers',
    subject: 'Mathematics',
    lesson: 'Lesson 08 · Probability',
    progress: 68,
    image: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=720&q=85',
    tone: 'peach',
    icon: 'Target',
    learningContent: 'Probability describes how likely an event is. Divide favorable outcomes by all equally likely outcomes. List the sample space first, then count the outcomes that match.',
  },
  {
    title: 'A living, breathing world',
    subject: 'Biology',
    lesson: 'Lesson 04 · Cell structure',
    progress: 42,
    image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=720&q=85',
    tone: 'mint',
    icon: 'FlaskConical',
    learningContent: 'The cell membrane is selectively permeable: it controls which substances enter and leave the cell. The nucleus stores DNA, while mitochondria release usable energy.',
  },
  {
    title: 'Small things, big energy',
    subject: 'Physics',
    lesson: 'Lesson 11 · Atomic theory',
    progress: 25,
    image: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&w=720&q=85',
    tone: 'lavender',
    icon: 'Sparkles',
    learningContent: 'Atoms contain protons and neutrons in a central nucleus, with electrons arranged around it. In a neutral atom, the number of electrons equals the number of protons.',
  },
]

function newDatabase(): LocalDatabase {
  return {
    accounts: [],
    currentUserId: null,
    coursesByUser: {},
    tasksByUser: {},
    notesByUser: {},
    messagesByUser: {},
    resetTokens: {},
  }
}

function readDatabase(): LocalDatabase {
  try {
    const saved = localStorage.getItem(storageKey)
    return saved ? { ...newDatabase(), ...JSON.parse(saved) as Partial<LocalDatabase> } : newDatabase()
  } catch {
    return newDatabase()
  }
}

function writeDatabase(database: LocalDatabase) {
  localStorage.setItem(storageKey, JSON.stringify(database))
}

function createId() {
  return crypto.randomUUID()
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hashPassword(password: string, salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)))) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: passwordIterations, hash: 'SHA-256' }, key, 256)
  return `${salt}:${bytesToHex(new Uint8Array(bits))}`
}

function requireCurrentAccount(database: LocalDatabase) {
  const account = database.accounts.find(({ user }) => user.id === database.currentUserId)
  if (!account) throw new Error('Sign in to open your learning space.')
  return account
}

function seedAccountData(database: LocalDatabase, userId: string) {
  database.coursesByUser[userId] = starterCourses.map((course, index) => ({ ...course, _id: `${userId}-course-${index + 1}` }))
  database.tasksByUser[userId] = [
    { _id: `${userId}-task-1`, title: 'Review yesterday’s notes', detail: 'Mathematics · 10 min', completed: true },
    { _id: `${userId}-task-2`, title: 'Finish cell structure quiz', detail: 'Biology · 5 questions', completed: false },
    { _id: `${userId}-task-3`, title: 'Start a focus session', detail: 'Physics · 25 min', completed: false },
  ]
  database.notesByUser[userId] = [
    { _id: `${userId}-note-1`, title: 'Probability shortcuts', subject: 'Mathematics', content: 'Favorable outcomes divided by all possible outcomes. Write down the sample space first so you don’t miss any.', tag: 'UNIT 04', createdAt: new Date().toISOString() },
    { _id: `${userId}-note-2`, title: 'Cell membrane = a gatekeeper', subject: 'Biology', content: 'It decides what enters and leaves the cell. Selectively permeable means it lets some substances through, but not others.', tag: 'UNIT 02', createdAt: new Date().toISOString() },
  ]
  database.messagesByUser[userId] = []
}

export async function getCurrentUser() {
  const database = readDatabase()
  const account = database.accounts.find(({ user }) => user.id === database.currentUserId)
  return { user: account?.user ?? null }
}

export async function login(email: string, password: string) {
  const database = readDatabase()
  const account = database.accounts.find(({ user }) => user.email === email.trim().toLowerCase())
  if (!account) throw new Error('No local account was found for that email.')
  const [salt, savedHash] = account.passwordHash.split(':')
  if (!salt || await hashPassword(password, salt) !== `${salt}:${savedHash}`) throw new Error('That password is not correct.')
  database.currentUserId = account.user.id
  writeDatabase(database)
  return { user: account.user }
}

export async function register(displayName: string, email: string, password: string): Promise<{ user: User; verificationUrl?: string; verificationSent: boolean }> {
  const database = readDatabase()
  const normalizedEmail = email.trim().toLowerCase()
  if (database.accounts.some(({ user }) => user.email === normalizedEmail)) {
    throw new Error('A local account already exists for that email. Sign in instead.')
  }
  const user: User = { id: createId(), displayName: displayName.trim(), email: normalizedEmail, emailVerified: true }
  database.accounts.push({ user, passwordHash: await hashPassword(password) })
  database.currentUserId = user.id
  seedAccountData(database, user.id)
  writeDatabase(database)
  return { user, verificationSent: false }
}

export async function logout() {
  const database = readDatabase()
  database.currentUserId = null
  writeDatabase(database)
  return { loggedOut: true }
}

export async function getDashboard(): Promise<Dashboard> {
  const database = readDatabase()
  const { user } = requireCurrentAccount(database)
  const courses = database.coursesByUser[user.id] ?? []
  const tasks = database.tasksByUser[user.id] ?? []
  return {
    courses,
    tasks,
    stats: { completedGoals: tasks.filter((task) => task.completed).length, totalGoals: tasks.length },
  }
}

export async function getNotes() {
  const { user } = requireCurrentAccount(readDatabase())
  return readDatabase().notesByUser[user.id] ?? []
}

export async function getTutorMessages(subject: string) {
  const database = readDatabase()
  const { user } = requireCurrentAccount(database)
  return (database.messagesByUser[user.id] ?? []).filter((message) => {
    const course = database.coursesByUser[user.id]?.find((item) => item.subject === subject)
    return message.content.startsWith(`[${subject}]`) || message._id.startsWith(`${course?._id ?? ''}-`)
  }).map((message) => ({ ...message, content: message.content.replace(/^\[[^\]]+\] /, '') }))
}

export async function createTask(title: string) {
  const database = readDatabase()
  const { user } = requireCurrentAccount(database)
  const task = { _id: createId(), title, detail: 'Personal · Today', completed: false }
  database.tasksByUser[user.id] = [...(database.tasksByUser[user.id] ?? []), task]
  writeDatabase(database)
  return task
}

export async function createNote(note: Pick<StudyNote, 'title' | 'subject' | 'content' | 'tag'>) {
  const database = readDatabase()
  const { user } = requireCurrentAccount(database)
  const savedNote = { ...note, _id: createId(), createdAt: new Date().toISOString() }
  database.notesByUser[user.id] = [savedNote, ...(database.notesByUser[user.id] ?? [])]
  writeDatabase(database)
  return savedNote
}

export async function deleteNote(id: string) {
  const database = readDatabase()
  const { user } = requireCurrentAccount(database)
  database.notesByUser[user.id] = (database.notesByUser[user.id] ?? []).filter((note) => note._id !== id)
  writeDatabase(database)
  return { deleted: true, id }
}

export async function updateTask(id: string, completed: boolean) {
  const database = readDatabase()
  const { user } = requireCurrentAccount(database)
  const task = (database.tasksByUser[user.id] ?? []).find((item) => item._id === id)
  if (!task) throw new Error('That task could not be found.')
  task.completed = completed
  writeDatabase(database)
  return task
}

export async function deleteTask(id: string) {
  const database = readDatabase()
  const { user } = requireCurrentAccount(database)
  database.tasksByUser[user.id] = (database.tasksByUser[user.id] ?? []).filter((task) => task._id !== id)
  writeDatabase(database)
  return { deleted: true, id }
}

export async function updateCourseProgress(id: string, progress: number) {
  const database = readDatabase()
  const { user } = requireCurrentAccount(database)
  const course = (database.coursesByUser[user.id] ?? []).find((item) => item._id === id)
  if (!course) throw new Error('That course could not be found.')
  course.progress = Math.max(0, Math.min(100, progress))
  writeDatabase(database)
  return course
}

export async function sendTutorMessage(content: string, subject: string) {
  const database = readDatabase()
  const { user } = requireCurrentAccount(database)
  const course = (database.coursesByUser[user.id] ?? []).find((item) => item.subject === subject)
  const now = new Date().toISOString()
  const question: StudyMessage = { _id: createId(), role: 'student', content: `[${subject}] ${content}`, createdAt: now }
  const answer = course
    ? `Let’s work through ${course.lesson}. ${course.learningContent ?? 'Start by identifying the key idea.'} What part would you like to explore?`
    : 'Choose a subject and tell me what you would like to learn.'
  const reply: StudyMessage = { _id: createId(), role: 'tutor', content: `[${subject}] ${answer}`, createdAt: new Date().toISOString() }
  database.messagesByUser[user.id] = [...(database.messagesByUser[user.id] ?? []), question, reply]
  writeDatabase(database)
  return database.messagesByUser[user.id]
    .filter((message) => message.content.startsWith(`[${subject}] `))
    .map((message) => ({ ...message, content: message.content.replace(/^\[[^\]]+\] /, '') }))
}

export async function requestPasswordReset(email: string) {
  const database = readDatabase()
  const account = database.accounts.find(({ user }) => user.email === email.trim().toLowerCase())
  if (!account) return { message: 'No local account was found for that email.' }
  const token = createId()
  database.resetTokens[token] = { userId: account.user.id, expiresAt: Date.now() + 30 * 60 * 1000 }
  writeDatabase(database)
  const resetUrl = new URL(window.location.pathname, window.location.origin)
  resetUrl.searchParams.set('mode', 'reset')
  resetUrl.searchParams.set('token', token)
  return { message: 'Open the local reset link to choose a new password.', resetUrl: resetUrl.toString() }
}

export async function resetPassword(token: string, password: string) {
  const database = readDatabase()
  const reset = database.resetTokens[token]
  const account = reset && reset.expiresAt > Date.now()
    ? database.accounts.find(({ user }) => user.id === reset.userId)
    : undefined
  if (!account) throw new Error('This local password reset link is invalid or expired.')
  account.passwordHash = await hashPassword(password)
  database.currentUserId = account.user.id
  delete database.resetTokens[token]
  writeDatabase(database)
  return { user: account.user }
}

export async function verifyEmail(token: string) {
  const database = readDatabase()
  const account = database.accounts.find(({ user }) => user.id === database.currentUserId)
  if (!account || !token) throw new Error('This local verification link is invalid.')
  account.user.emailVerified = true
  writeDatabase(database)
  return { user: account.user, verified: true }
}