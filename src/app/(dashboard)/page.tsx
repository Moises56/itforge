import { getCurrentUser } from '@/core/auth/get-current-user'
import { logoutAction } from '@/app/(auth)/login/actions'

export default async function DashboardPage() {
  const user = await getCurrentUser()

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-slate-900 mb-1">
        Bienvenido, {user.firstName}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Sesión activa para <span className="font-medium text-slate-700">{user.email}</span>
      </p>

      <div className="bg-white rounded-xl border border-slate-200 p-4 text-xs text-slate-500 mb-6 font-mono">
        <p>organizationId: {user.organizationId}</p>
        <p>roles: {user.roles.length > 0 ? user.roles.join(', ') : '(sin roles)'}</p>
      </div>

      {/* Logout */}
      <form action={logoutAction}>
        <button
          type="submit"
          className="text-sm text-red-600 hover:text-red-700 underline underline-offset-2"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  )
}
