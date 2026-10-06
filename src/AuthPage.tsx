import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, GraduationCap, Sparkles } from 'lucide-react'
import { login, register, requestPasswordReset, resetPassword, verifyEmail, type User } from './api'

type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'verify'

type AuthPageProps = {
  onAuthenticated: (user: User, verificationUrl?: string) => void
  initialError?: string
  initialMode?: AuthMode
  token?: string
}

function AuthPage({ onAuthenticated, initialError = '', initialMode = 'login', token = '' }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(initialError)
  const [message, setMessage] = useState('')
  const [resetUrl, setResetUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const verificationStarted = useRef(false)

  useEffect(() => {
    if (initialMode !== 'verify' || verificationStarted.current) return
    verificationStarted.current = true
    setIsSubmitting(true)
    verifyEmail(token)
      .then(() => {
        setMode('login')
        setMessage('Your email is verified. You can sign in now.')
        window.history.replaceState(null, '', window.location.pathname)
      })
      .catch((verifyError: unknown) => {
        setError(verifyError instanceof Error ? verifyError.message : 'Could not verify this email.')
        setMode('login')
      })
      .finally(() => setIsSubmitting(false))
  }, [initialMode, token])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    if ((mode === 'register' || mode === 'reset') && password !== confirmation) {
      setError('Those passwords do not match yet.')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'forgot') {
        const result = await requestPasswordReset(email)
        setMessage(result.message)
        setResetUrl(result.resetUrl || '')
      } else if (mode === 'reset') {
        const result = await resetPassword(token, password)
        onAuthenticated(result.user)
      } else if (mode === 'register') {
        const result = await register(name, email, password)
        onAuthenticated(result.user, result.verificationUrl)
      } else if (mode === 'login') {
        const result = await login(email, password)
        onAuthenticated(result.user)
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'We could not sign you in. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError('')
    setMessage('')
    setResetUrl('')
    setPassword('')
    setConfirmation('')
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="Orbit learning">
        <div className="auth-story-image" role="img" aria-label="A quiet library study table" />
        <div className="auth-story-content">
          <a className="auth-brand" href="#home">
            <span className="brand-mark"><GraduationCap size={20} strokeWidth={2.2} /></span>
            <span>orbit<span className="brand-period">.</span></span>
          </a>
          <div className="auth-quote">
            <span className="auth-quote-mark">“</span>
            <h1>Every big understanding begins with a small why.</h1>
            <p>A little curiosity can take you a long way.</p>
          </div>
          <div className="auth-story-footer"><Sparkles size={15} /><span>MADE FOR CURIOUS MINDS</span></div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-top"><span>YOUR PERSONAL LEARNING SPACE</span><span className="auth-panel-dot" /></div>
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand"><span className="brand-mark"><GraduationCap size={19} /></span><span>orbit<span className="brand-period">.</span></span></div>
          <span className="eyebrow">{mode === 'login' ? 'PICK UP WHERE YOU LEFT OFF' : mode === 'register' ? 'START YOUR LEARNING JOURNEY' : mode === 'forgot' ? 'ACCOUNT RECOVERY' : mode === 'reset' ? 'CHOOSE A NEW PASSWORD' : 'VERIFYING YOUR EMAIL'}</span>
          <h2>{mode === 'login' ? 'Welcome back.' : mode === 'register' ? 'Make room for wonder.' : mode === 'forgot' ? 'Let’s get you back in.' : mode === 'reset' ? 'A fresh start.' : 'One moment.'}</h2>
          <p className="auth-intro">{mode === 'login' ? 'Your next small win is waiting.' : mode === 'register' ? 'One curious question can change your whole day.' : mode === 'forgot' ? 'We’ll send a secure link to reset your password.' : mode === 'reset' ? 'Choose a new password for your Orbit account.' : 'We’re checking your verification link.'}</p>

          {(mode === 'login' || mode === 'register') && <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={`auth-tab ${mode === 'login' ? 'auth-tab-active' : ''}`} onClick={() => changeMode('login')}>Sign in</button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={`auth-tab ${mode === 'register' ? 'auth-tab-active' : ''}`} onClick={() => changeMode('register')}>Create account</button>
          </div>}

          <form className="auth-form" onSubmit={submit}>
            {mode === 'register' && <label>Your name<input autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Maya Chen" /></label>}
            {(mode === 'login' || mode === 'register' || mode === 'forgot') && <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>}
            {(mode === 'login' || mode === 'register' || mode === 'reset') && <label>{mode === 'reset' ? 'New password' : 'Password'}<span className="auth-password-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>}
            {(mode === 'register' || mode === 'reset') && <label>Confirm password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Enter your password again" /></label>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            {message && <p className="auth-message" role="status">{message}{resetUrl && <> <a href={resetUrl}>Open password reset</a></>}</p>}
            {mode !== 'verify' && <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'One moment…' : mode === 'login' ? 'Sign in to Orbit' : mode === 'register' ? 'Create my account' : mode === 'forgot' ? 'Send reset instructions' : 'Save new password'}{!isSubmitting && <ArrowRight size={16} />}</button>}
          </form>

          {mode === 'login' && <p className="auth-forgot"><button type="button" onClick={() => changeMode('forgot')}>Forgot your password?</button></p>}
          {(mode === 'login' || mode === 'register') && <p className="auth-switch">{mode === 'login' ? 'New to Orbit?' : 'Already have a space?'} <button type="button" onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Create an account' : 'Sign in instead'}</button></p>}
          {(mode === 'forgot' || mode === 'reset') && <p className="auth-switch">Remember your password? <button type="button" onClick={() => changeMode('login')}>Back to sign in</button></p>}
          <p className="auth-privacy">Your learning space is private to your account.</p>
        </div>
        <footer className="auth-panel-footer"><span>ORBIT LEARNING</span><span>TAKE IT ONE STEP AT A TIME</span></footer>
      </section>
    </main>
  )
}

export default AuthPage