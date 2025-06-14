import type { Metadata } from 'next'
import Head from 'next/head'
import '@/app/globals.css'
import { AppWrapper } from '@/app/components/AppContext'
import Layout from '@/app/components/Layout'

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
      <body>
        <AppWrapper>
          <Layout>{children}</Layout>
        </AppWrapper>
      </body>
    </html>
  )
}
