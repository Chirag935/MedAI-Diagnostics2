import './globals.css'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/context/ThemeContext'
import { ToastProvider } from '@/context/ToastContext'
import { SessionProvider } from '@/context/SessionContext'
import { LanguageProvider } from '@/context/LanguageContext'
import { AuthProvider } from '@/context/AuthContext'
import ErrorSuppressor from '@/components/ErrorSuppressor'
import { TP } from '@/components/TP'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'MedAI Diagnostics - Medical AI Disease Detection Platform',
  description: 'Advanced AI-powered disease detection and prediction platform for medical diagnostics',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ErrorSuppressor />
        <ThemeProvider>
          <ToastProvider>
            <LanguageProvider>
              <AuthProvider>
                <SessionProvider>
                  <TP>{children}</TP>
                </SessionProvider>
              </AuthProvider>
            </LanguageProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
