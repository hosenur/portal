import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'

export const metadata = {
  title: 'OpenPortal Docs',
  description: 'Documentation for OpenPortal'
}

const navbar = (
  <Navbar
    logo={<b>OpenPortal</b>}
  />
)

const footer = <Footer>MIT {new Date().getFullYear()} © OpenPortal.</Footer>

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/hosenur/portal/tree/main/apps/docs-2"
          footer={footer}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
