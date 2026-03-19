import type { Metadata } from 'next'
import { LoginForm } from './_components/login-form'

export const metadata: Metadata = {
  title: `Iniciar sesión | ${process.env.NEXT_PUBLIC_APP_NAME ?? 'ITForge'}`,
}

export default function LoginPage() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'ITForge'

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg mb-4">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{appName}</h1>
          <p className="text-sm text-slate-500 mt-1">Sistema de Gestión de Portafolio TI</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-800">Iniciar sesión</h2>
            <p className="text-sm text-slate-500 mt-0.5">Ingresa tus credenciales para continuar</p>
          </div>

          <LoginForm />
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          {appName} &mdash; Uso exclusivo para personal autorizado
        </p>
      </div>
    </main>
  )
}
