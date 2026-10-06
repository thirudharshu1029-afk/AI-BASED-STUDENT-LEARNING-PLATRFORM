export type Course = {
  _id: string
  title: string
  subject: string
  lesson: string
  progress: number
  image: string
  tone: string
  icon: string
}

export type User = { id: string; displayName: string; email: string; emailVerified: boolean }

export const getCurrentUser = () => request<{ user: User | null }>('/auth/me')

export const login = (email: string, password: string) =>
  request<{ user: User }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

export const register = (displayName: string, email: string, password: string) =>
  request<{ user: User; verificationUrl?: string; verificationSent: boolean }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ displayName, email, password }),
  })

export const logout = () =>
  request<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' })

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)
  return result as T
}

export const getDashboard = () => request<Dashboard>('/dashboard')
export const getNotes = () => request<StudyNote[]>('/notes')
export const getTutorMessages = (subject: string) =>
  request<StudyMessage[]>(`/tutor/messages?subject=${encodeURIComponent(subject)}`)

export const createTask = (title: string) =>
  request<StudyTask>('/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, detail: 'Personal · Today' }),
  })

export const createNote = (note: Pick<StudyNote, 'title' | 'subject' | 'content' | 'tag'>) =>
  request<StudyNote>('/notes', { method: 'POST', body: JSON.stringify(note) })

export const deleteNote = (id: string) =>
  request<{ deleted: boolean; id: string }>(`/notes/${id}`, { method: 'DELETE' })

export const updateTask = (id: string, completed: boolean) =>
  request<StudyTask>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ completed }) })

export const deleteTask = (id: string) =>
  request<{ deleted: boolean; id: string }>(`/tasks/${id}`, { method: 'DELETE' })

export const updateCourseProgress = (id: string, progress: number) =>
  request<Course>(`/courses/${id}/progress`, { method: 'PATCH', body: JSON.stringify({ progress }) })

export const sendTutorMessage = (content: string, subject: string) =>
  request<StudyMessage[]>('/tutor/messages', {
    method: 'POST',
    body: JSON.stringify({ content, subject }),
  })

export const requestPasswordReset = (email: string) =>
  request<{ message: string; resetUrl?: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })

export const resetPassword = (token: string, password: string) =>
  request<{ user: User }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })

export const verifyEmail = (token: string) =>
  request<{ user: User; verified: boolean }>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })