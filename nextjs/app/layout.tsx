import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Head from 'next/head'
import '@/app/globals.css'
import { AppWrapper } from '@/app/components/AppContext'
import Layout from '@/app/components/Layout'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    absolute: '',
    // default: process.env.APP_NAME!,
    template: `%s | ${process.env.APP_NAME!}`
  },
  description: 'Cod Tracker',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en'>
      <Head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </Head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppWrapper>
          <Layout>{children}</Layout>
        </AppWrapper>
      </body>
    </html>
  )
}
