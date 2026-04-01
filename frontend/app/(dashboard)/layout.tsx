import Header from '@/components/layout/Header'
import NavTabs from '@/components/layout/NavTabs'

/*
 * SHARED DASHBOARD LAYOUT
 *
 * Header + NavTabs render ONCE here — every page inside (dashboard)/
 * inherits them automatically.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: '#f8fafc', position: 'relative', zIndex: 1 }}>
      <Header />
      <NavTabs />
      <main>
        {children}
      </main>
    </div>
  )
}
