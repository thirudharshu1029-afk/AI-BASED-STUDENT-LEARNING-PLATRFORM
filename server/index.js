import 'dotenv/config'
import cors from 'cors'
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import mongoose from 'mongoose'
import nodemailer from 'nodemailer'
import { promisify } from 'node:util'

const { Schema } = mongoose
const app = express()
const port = Number(process.env.PORT || 4000)
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/orbit_learning'
const hashPassword = promisify(scrypt)
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000
const sessionCookieName = 'orbit_session'
const actionTokenLifetimeMs = 30 * 60 * 1000
const clientOrigin = process.env.APP_ORIGIN || process.env.CLIENT_ORIGIN || 'http://localhost:5173'
const mailer = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    })
  : null

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use(express.json({ limit: '16kb' }))

const courseSchema = new Schema({
  slug: { type: String, required: true, unique: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  subject: { type: String, required: true },
  lesson: { type: String, required: true },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  learningContent: { type: String, required: true },
  image: { type: String, required: true },
  tone: { type: String, default: 'mint' },
  icon: { type: String, default: 'BookOpen' },
  order: { type: Number, default: 0 },
}, { timestamps: true })

const taskSchema = new Schema({
  seedKey: { type: String, unique: true, sparse: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true },
  detail: { type: String, default: '' },
  completed: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { timestamps: true })

const noteSchema = new Schema({
  seedKey: { type: String, unique: true, sparse: true },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  subject: { type: String, default: 'Personal', trim: true, maxlength: 60 },
  content: { type: String, default: '', trim: true, maxlength: 4000 },
  tag: { type: String, default: 'PERSONAL', trim: true, maxlength: 40 },
}, { timestamps: true })

const messageSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ['student', 'tutor'], required: true },
  content: { type: String, required: true, trim: true, maxlength: 2000 },
  subject: { type: String, default: 'Mathematics' },
}, { timestamps: true })

const userSchema = new Schema({
  displayName: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  emailVerified: { type: Boolean, default: false },
}, { timestamps: true })

const sessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true })

const actionTokenSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, enum: ['password-reset', 'email-verification'], required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true })

const User = mongoose.model('User', userSchema)
const Session = mongoose.model('Session', sessionSchema)
const ActionToken = mongoose.model('ActionToken', actionTokenSchema)
const Course = mongoose.model('Course', courseSchema)
const Task = mongoose.model('Task', taskSchema)
const Note = mongoose.model('Note', noteSchema)
const StudyMessage = mongoose.model('StudyMessage', messageSchema)

const starterCourses = [
  {
    slug: 'language-of-numbers',
    title: 'The language of numbers',
    subject: 'Mathematics',
    lesson: 'Lesson 08 · Probability',
    learningContent: 'Probability describes how likely an event is. The probability of an event is the number of favorable outcomes divided by the total number of equally likely outcomes. First list the sample space, then count the outcomes that match the event. For independent events, multiply their probabilities.',
    progress: 68,
    image: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=720&q=85',
    tone: 'peach',
    icon: 'Target',
    order: 1,
  },
  {
    slug: 'living-breathing-world',
    title: 'A living, breathing world',
    subject: 'Biology',
    lesson: 'Lesson 04 · Cell structure',
    learningContent: 'The cell membrane is selectively permeable: it controls which substances enter and leave the cell. The nucleus stores DNA and directs cell activity, while mitochondria release usable energy through respiration. Plant cells also have a cell wall, chloroplasts, and a large permanent vacuole.',
    progress: 42,
    image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=720&q=85',
    tone: 'mint',
    icon: 'FlaskConical',
    order: 2,
  },
  {
    slug: 'small-things-big-energy',
    title: 'Small things, big energy',
    subject: 'Physics',
    lesson: 'Lesson 11 · Atomic theory',
    learningContent: 'Atoms contain protons and neutrons in a tiny central nucleus, with electrons arranged around it. The proton number identifies the element. In a neutral atom, the number of electrons equals the number of protons. Isotopes are atoms of the same element with different numbers of neutrons.',
    progress: 25,
    image: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&w=720&q=85',
    tone: 'lavender',
    icon: 'Sparkles',
    order: 3,
  },
]

const starterTasks = [
  { seedKey: 'review-notes', title: 'Review yesterday’s notes', detail: 'Mathematics · 10 min', completed: true, order: 1 },
  { seedKey: 'cell-quiz', title: 'Finish cell structure quiz', detail: 'Biology · 5 questions', completed: false, order: 2 },
  { seedKey: 'focus-session', title: 'Start a focus session', detail: 'Physics · 25 min', completed: false, order: 3 },
]

const starterNotes = [
  {
    seedKey: 'probability-shortcuts',
    title: 'Probability shortcuts',
    subject: 'Mathematics',
    content: 'Favorable outcomes divided by all possible outcomes. Write down the sample space first so you don’t miss any.',
    tag: 'UNIT 04',
  },
  {
    seedKey: 'cell-membrane-gatekeeper',
    title: 'Cell membrane = a gatekeeper',
    subject: 'Biology',
    content: 'It decides what enters and leaves the cell. Selectively permeable means it lets some substances through, but not others.',
    tag: 'UNIT 02',
  },
]

async function seedCollection(Model, documents, key, owner) {
  await Promise.all(documents.map((document) =>
    Model.updateOne(
      { owner, [key]: `${owner}-${document[key]}` },
      { $setOnInsert: { ...document, owner, [key]: `${owner}-${document[key]}` } },
      { upsert: true },
    ),
  ))
}

async function seedUserData(owner) {
  await seedCollection(Course, starterCourses, 'slug', owner)
  await Promise.all(starterCourses.map((course) =>
    Course.updateOne(
      { owner, slug: `${owner}-${course.slug}` },
      { $set: { learningContent: course.learningContent } },
    ),
  ))
  await seedCollection(Task, starterTasks, 'seedKey', owner)
  await seedCollection(Note, starterNotes, 'seedKey', owner)
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' })
})

function publicUser(user) {
  return { id: user.id, displayName: user.displayName, email: user.email, emailVerified: user.emailVerified }
}

function cookieToken(request) {
  const prefix = `${sessionCookieName}=`
  const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : ''
}

function digestToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionLifetimeMs / 1000}${secure}`,
  )
}

async function createSession(user, response) {
  const token = randomBytes(32).toString('hex')
  await Session.create({
    tokenHash: digestToken(token),
    user: user._id,
    expiresAt: new Date(Date.now() + sessionLifetimeMs),
  })
  setSessionCookie(response, token)
}

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many account requests. Please wait a little and try again.' },
})

async function issueActionToken(user, purpose) {
  await ActionToken.deleteMany({ user: user._id, purpose })
  const token = randomBytes(32).toString('hex')
  await ActionToken.create({
    tokenHash: digestToken(token),
    user: user._id,
    purpose,
    expiresAt: new Date(Date.now() + actionTokenLifetimeMs),
  })
  return token
}

async function sendActionEmail(user, subject, message) {
  if (!mailer) return false
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: user.email,
    subject,
    text: message,
  })
  return true
}

function accountActionUrl(path, token) {
  const url = new URL(path, clientOrigin)
  url.searchParams.set('token', token)
  return url.toString()
}

app.use([
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
], authRateLimit)

async function requireAuth(request, response, next) {
  const token = cookieToken(request)
  if (!token) return response.status(401).json({ error: 'Please sign in to continue.' })
  try {
    const session = await Session.findOne({ tokenHash: digestToken(token), expiresAt: { $gt: new Date() } })
      .populate('user')
    if (!session?.user) return response.status(401).json({ error: 'Your session expired. Please sign in again.' })
    request.user = session.user
    return next()
  } catch (error) {
    return next(error)
  }
}

app.get('/api/auth/me', async (request, response) => {
  const token = cookieToken(request)
  if (!token) return response.json({ user: null })
  const session = await Session.findOne({ tokenHash: digestToken(token), expiresAt: { $gt: new Date() } })
    .populate('user')
  response.json({ user: session?.user ? publicUser(session.user) : null })
})

app.post('/api/auth/register', async (request, response) => {
  const displayName = typeof request.body.displayName === 'string' ? request.body.displayName.trim() : ''
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const password = typeof request.body.password === 'string' ? request.body.password : ''
  if (displayName.length < 2 || displayName.length > 80) {
    return response.status(400).json({ error: 'Enter a name between 2 and 80 characters.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return response.status(400).json({ error: 'Enter a valid email address.' })
  }
  if (password.length < 8 || password.length > 128) {
    return response.status(400).json({ error: 'Your password must be between 8 and 128 characters.' })
  }
  if (await User.exists({ email })) return response.status(409).json({ error: 'An account with this email already exists.' })

  const salt = randomBytes(16).toString('hex')
  const derivedKey = await hashPassword(password, salt, 64)
  const user = await User.create({ displayName, email, passwordHash: `${salt}:${derivedKey.toString('hex')}` })
  await seedUserData(user._id)
  const verificationToken = await issueActionToken(user, 'email-verification')
  let verificationUrl = ''
  let verificationSent = false
  if (mailer) {
    try {
      const emailUrl = accountActionUrl('/', verificationToken)
      emailUrl.searchParams.set('mode', 'verify')
      verificationSent = await sendActionEmail(
        user,
        'Verify your Orbit email',
        `Hi ${displayName},\n\nVerify your email address by opening this link within 30 minutes:\n${emailUrl.toString()}`,
      )
    } catch (error) {
      console.error('Could not send the email verification message.', error)
    }
  } else if (process.env.NODE_ENV !== 'production') {
    const localUrl = accountActionUrl('/', verificationToken)
    localUrl.searchParams.set('mode', 'verify')
    verificationUrl = localUrl.toString()
  }
  await createSession(user, response)
  response.status(201).json({
    user: publicUser(user),
    verificationSent,
    ...(verificationUrl ? { verificationUrl } : {}),
  })
})

app.post('/api/auth/login', async (request, response) => {
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const password = typeof request.body.password === 'string' ? request.body.password : ''
  const user = await User.findOne({ email }).select('+passwordHash')
  if (!user) return response.status(401).json({ error: 'Email or password is incorrect.' })
  const [salt, storedHash] = user.passwordHash.split(':')
  const submittedHash = await hashPassword(password, salt, 64)
  const expectedHash = Buffer.from(storedHash, 'hex')
  if (submittedHash.length !== expectedHash.length || !timingSafeEqual(submittedHash, expectedHash)) {
    return response.status(401).json({ error: 'Email or password is incorrect.' })
  }
  await createSession(user, response)
  response.json({ user: publicUser(user) })
})

app.post('/api/auth/forgot-password', async (request, response) => {
  const email = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : ''
  const genericMessage = 'If an account exists for that email, password reset instructions are ready.'
  const user = await User.findOne({ email })
  if (!user) return response.json({ message: genericMessage })

  const token = await issueActionToken(user, 'password-reset')
  const resetUrl = accountActionUrl('/', token)
  resetUrl.searchParams.set('mode', 'reset')
  if (mailer) {
    await sendActionEmail(
      user,
      'Reset your Orbit password',
      `Hi ${user.displayName},\n\nReset your password within 30 minutes using this link:\n${resetUrl.toString()}\n\nIf you did not request this, you can ignore this message.`,
    )
    return response.json({ message: genericMessage })
  }

  response.json({
    message: genericMessage,
    ...(process.env.NODE_ENV === 'production' ? {} : { resetUrl: resetUrl.toString() }),
  })
})

app.post('/api/auth/reset-password', async (request, response) => {
  const token = typeof request.body.token === 'string' ? request.body.token : ''
  const password = typeof request.body.password === 'string' ? request.body.password : ''
  if (password.length < 8 || password.length > 128) {
    return response.status(400).json({ error: 'Your password must be between 8 and 128 characters.' })
  }
  const actionToken = await ActionToken.findOneAndDelete({
    tokenHash: digestToken(token),
    purpose: 'password-reset',
    expiresAt: { $gt: new Date() },
  })
  if (!actionToken) return response.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' })

  const salt = randomBytes(16).toString('hex')
  const derivedKey = await hashPassword(password, salt, 64)
  const user = await User.findByIdAndUpdate(
    actionToken.user,
    { passwordHash: `${salt}:${derivedKey.toString('hex')}` },
    { new: true },
  )
  await Promise.all([
    ActionToken.deleteMany({ user: actionToken.user, purpose: 'password-reset' }),
    Session.deleteMany({ user: actionToken.user }),
  ])
  if (!user) return response.status(400).json({ error: 'This reset link is no longer valid.' })
  await createSession(user, response)
  response.json({ user: publicUser(user) })
})

app.post('/api/auth/verify-email', async (request, response) => {
  const token = typeof request.body.token === 'string' ? request.body.token : ''
  const actionToken = await ActionToken.findOneAndDelete({
    tokenHash: digestToken(token),
    purpose: 'email-verification',
    expiresAt: { $gt: new Date() },
  })
  if (!actionToken) return response.status(400).json({ error: 'This verification link is invalid or has expired.' })
  const user = await User.findByIdAndUpdate(actionToken.user, { emailVerified: true }, { new: true })
  await ActionToken.deleteMany({ user: actionToken.user, purpose: 'email-verification' })
  if (!user) return response.status(400).json({ error: 'This verification link is no longer valid.' })
  response.json({ user: publicUser(user), verified: true })
})

app.post('/api/auth/logout', async (request, response) => {
  const token = cookieToken(request)
  if (token) await Session.deleteOne({ tokenHash: digestToken(token) })
  response.setHeader('Set-Cookie', `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`)
  response.json({ loggedOut: true })
})

app.use('/api', requireAuth)

app.get('/api/dashboard', async (request, response) => {
  const [courses, tasks] = await Promise.all([
    Course.find({ owner: request.user._id }).sort({ order: 1 }).lean(),
    Task.find({ owner: request.user._id }).sort({ order: 1, createdAt: 1 }).lean(),
  ])
  response.json({
    courses,
    tasks,
    stats: { completedGoals: tasks.filter((task) => task.completed).length, totalGoals: tasks.length },
  })
})

app.post('/api/tasks', async (request, response) => {
  const title = typeof request.body.title === 'string' ? request.body.title.trim() : ''
  if (!title) return response.status(400).json({ error: 'A task title is required.' })
  const task = await Task.create({ owner: request.user._id, title, detail: request.body.detail || '', order: Date.now() })
  response.status(201).json(task)
})

app.patch('/api/tasks/:id', async (request, response) => {
  if (typeof request.body.completed !== 'boolean') {
    return response.status(400).json({ error: 'completed must be true or false.' })
  }
  const task = await Task.findByIdAndUpdate(
    { _id: request.params.id, owner: request.user._id },
    { completed: request.body.completed },
    { new: true, runValidators: true },
  )
  if (!task) return response.status(404).json({ error: 'Task not found.' })
  response.json(task)
})

app.delete('/api/tasks/:id', async (request, response) => {
  const task = await Task.findOneAndDelete({ _id: request.params.id, owner: request.user._id })
  if (!task) return response.status(404).json({ error: 'Task not found.' })
  response.json({ deleted: true, id: task.id })
})

app.patch('/api/courses/:id/progress', async (request, response) => {
  const progress = Number(request.body.progress)
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    return response.status(400).json({ error: 'progress must be an integer from 0 to 100.' })
  }
  const course = await Course.findByIdAndUpdate(
    { _id: request.params.id, owner: request.user._id },
    { progress },
    { new: true, runValidators: true },
  )
  if (!course) return response.status(404).json({ error: 'Course not found.' })
  response.json(course)
})

app.get('/api/notes', async (request, response) => {
  response.json(await Note.find({ owner: request.user._id }).sort({ createdAt: -1 }).lean())
})

app.post('/api/notes', async (request, response) => {
  const title = typeof request.body.title === 'string' ? request.body.title.trim() : ''
  if (!title) return response.status(400).json({ error: 'A note title is required.' })
  const note = await Note.create({
    owner: request.user._id,
    title,
    subject: request.body.subject || 'Personal',
    content: request.body.content || '',
    tag: request.body.tag || 'PERSONAL',
  })
  response.status(201).json(note)
})

app.delete('/api/notes/:id', async (request, response) => {
  const note = await Note.findOneAndDelete({ _id: request.params.id, owner: request.user._id })
  if (!note) return response.status(404).json({ error: 'Note not found.' })
  response.json({ deleted: true, id: note.id })
})

app.get('/api/tutor/messages', async (request, response) => {
  const subject = typeof request.query.subject === 'string' ? request.query.subject : 'Mathematics'
  response.json(await StudyMessage.find({ owner: request.user._id, subject }).sort({ createdAt: 1 }).limit(60).lean())
})

function tutorFallback(question, course) {
  if (!course) {
    return 'I can help with the lessons in your learning space. Choose Mathematics, Biology, or Physics, then tell me which idea you want to work through.'
  }

  const practice = /practice|quiz|question|test me/i.test(question)
  const practiceQuestion = {
    Mathematics: 'A bag has 3 blue marbles and 2 red ones. What is the probability of picking a red marble?',
    Biology: 'Which cell structure controls what enters and leaves the cell, and what does selectively permeable mean?',
    Physics: 'A neutral atom has 6 protons. How many electrons does it have, and what is its element?',
  }[course.subject] || 'Explain one key idea from this lesson in your own words.'
  const lessonTip = {
    Mathematics: 'Try listing the possible outcomes before choosing the favorable ones. What outcomes can you write down for your example?',
    Biology: 'Try describing the structure first, then connect it to its job. Which part of the cell are you thinking about?',
    Physics: 'Start by identifying the particles and their charges, then check how many of each the atom contains. Want to try one together?',
  }[course.subject] || 'Let’s break the idea into smaller steps. Which part feels least clear?'

  return practice
    ? `Practice question for ${course.subject} (${course.lesson}): ${practiceQuestion} ${lessonTip}`
    : `Let’s work through ${course.lesson} together. ${course.learningContent} ${lessonTip}`
}

app.post('/api/tutor/messages', async (request, response) => {
  const content = typeof request.body.content === 'string' ? request.body.content.trim() : ''
  if (!content) return response.status(400).json({ error: 'A message is required.' })
  const subject = typeof request.body.subject === 'string' ? request.body.subject : 'Mathematics'
  const course = await Course.findOne({ subject, owner: request.user._id }).lean()
  let answer = tutorFallback(content, course)

  if (process.env.OPENAI_API_KEY && course) {
    const notes = await Note.find({ subject: course.subject, owner: request.user._id }).select('title content').limit(5).lean()
    const studyContext = [
      `Subject: ${course.subject}`,
      `Lesson: ${course.lesson}`,
      `Lesson material: ${course.learningContent}`,
      ...notes.map((note) => `Student note, ${note.title}: ${note.content}`),
    ].join('\n')
    const providerUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions'
    const providerHeaders = {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    }
    if (new URL(providerUrl).hostname === 'openrouter.ai') {
      providerHeaders['HTTP-Referer'] = clientOrigin
      providerHeaders['X-Title'] = 'Orbit Learning Platform'
    }
    const completion = await fetch(providerUrl, {
      method: 'POST',
      headers: providerHeaders,
      signal: AbortSignal.timeout(Number(process.env.OPENAI_TIMEOUT_MS || 45000)),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.5,
        messages: [
          {
            role: 'system',
            content: `You are Orbit, a patient secondary-school tutor. Teach with short, age-appropriate explanations and guided questions. Use the student's lesson material as the source of truth. Do not claim to know facts absent from it; ask a clarifying question when needed. Help students reason instead of only giving answers. Keep replies under 180 words.\n\n${studyContext}`,
          },
          { role: 'user', content },
        ],
      }),
    })
    if (!completion.ok) {
      throw new Error(`Tutor provider returned HTTP ${completion.status}. Check OPENAI_API_KEY and OPENAI_MODEL.`)
    }
    const result = await completion.json()
    answer = result.choices?.[0]?.message?.content?.trim()
    if (!answer) throw new Error('Tutor provider returned an empty reply.')
  }

  await StudyMessage.create([
    { role: 'student', content, subject, owner: request.user._id },
    { role: 'tutor', content: answer, subject, owner: request.user._id },
  ])
  response.status(201).json(await StudyMessage.find({ owner: request.user._id, subject }).sort({ createdAt: 1 }).limit(60).lean())
})

app.use((error, _request, response, _next) => {
  const status = error.name === 'ValidationError' || error.name === 'CastError' ? 400 : 500
  console.error(error)
  response.status(status).json({ error: status === 500 ? 'An unexpected server error occurred.' : error.message })
})

try {
  await mongoose.connect(mongoUri)
  app.listen(port, () => {
    console.log(`Orbit API listening at http://localhost:${port}`)
    console.log(`MongoDB connected: ${mongoose.connection.name}`)
  })
} catch (error) {
  console.error(`Could not connect to MongoDB at ${mongoUri}`, error)
  process.exit(1)
}