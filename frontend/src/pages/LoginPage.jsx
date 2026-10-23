import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { LoaderCircle, Lock, Mail, UserRound } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VozDeskLogo } from '@/components/icons'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

export default function LoginPage() {
  const { user, loading, signInWithPassword, signUp, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState('signin')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  if (!loading && user) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true); setError(null); setMessage(null)
    const { data, error: err } =
      mode === 'signin'
        ? await signInWithPassword(email, password)
        : await signUp(email, password, fullName)
    setBusy(false)
    if (err) return setError(err.message)
    if (mode === 'signup' && !data.session) {
      setMessage('Revisa tu correo para confirmar la cuenta.')
    }
  }

  async function handleGoogle() {
    setError(null)
    const { error: err } = await signInWithGoogle()
    if (err) setError(err.message)
  }

  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden px-4">
      {/* Glow de fondo */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-fuchsia-600/25 via-violet-600/20 to-indigo-600/10 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />

      <main className="relative w-full max-w-[380px] animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <VozDeskLogo className="mb-5 size-11 drop-shadow-[0_8px_24px_rgba(168,85,247,0.45)]" />
          <h1 className="text-xl font-semibold tracking-tight">
            {mode === 'signin' ? 'Inicia sesión en VozDesk' : 'Crea tu cuenta de VozDesk'}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Gestiona tus tareas hablando.</p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-card/70 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <Button id="google-login" type="button" variant="outline" onClick={handleGoogle} className="h-10 w-full gap-2 border-white/10 bg-white/[0.03] hover:bg-white/[0.07]">
            <GoogleIcon /> Continuar con Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-white/10" /> o con correo <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="grid gap-3.5">
            {mode === 'signup' && (
              <div className="grid gap-1.5">
                <Label htmlFor="full-name" className="text-xs text-muted-foreground">Nombre</Label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ada Lovelace" className="h-10 pl-9" />
                </div>
              </div>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">Correo</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" className="h-10 pl-9" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password" className="text-xs text-muted-foreground">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type="password" required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-10 pl-9" />
              </div>
            </div>

            {error && <p className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
            {message && <p className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{message}</p>}

            <Button id="email-submit" type="submit" disabled={busy} className="mt-1 h-10 w-full bg-gradient-to-r from-fuchsia-600 to-indigo-600 font-medium text-white shadow-lg shadow-fuchsia-900/30 hover:opacity-95">
              {busy && <LoaderCircle className="size-4 animate-spin" />}
              {mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-[13px] text-muted-foreground">
          {mode === 'signin' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            id="toggle-auth-mode"
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setMessage(null) }}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {mode === 'signin' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>
      </main>
    </div>
  )
}
