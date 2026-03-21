import type { Metadata } from 'next'
import { Rajdhani, Barlow, JetBrains_Mono } from 'next/font/google'
import Script from 'next/script'
import { getPublicOrgMeta } from '@/core/config/get-public-org-meta'
import './globals.css'

const rajdhani = Rajdhani({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-rajdhani',
  display: 'swap',
})

const barlow = Barlow({
  weight: ['300', '400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-barlow',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const meta = await getPublicOrgMeta()

  return {
    title: {
      template: `%s | ${meta.name}`,
      default: meta.name,
    },
    description: 'Sistema de Gestión de Portafolio TI',
    icons: meta.hasFavicon
      ? { icon: '/api/org/favicon', shortcut: '/api/org/favicon' }
      : undefined,
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * suppressHydrationWarning on <html>: the theme-init script may add the
     * 'light' class before React hydrates, which would otherwise cause a
     * className mismatch warning. Suppressing it here is intentional.
     */
    <html
      lang="es"
      className={`${rajdhani.variable} ${barlow.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full bg-background text-foreground" suppressHydrationWarning>
        {/*
         * beforeInteractive: runs before React hydration so the theme class
         * is applied before the first paint — no flash of unstyled content.
         * Only supported in the root App Router layout.
         */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('itforge-theme');if(t==='light')document.documentElement.classList.add('light')}catch(e){}`,
          }}
        />
        {children}
      </body>
    </html>
  )
}
