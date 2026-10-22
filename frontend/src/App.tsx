import { Link, NavLink, Route, Routes } from 'react-router'

import ThemeToggle from './components/ThemeToggle'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import ProjectsPage from './pages/ProjectsPage'

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/brand/protolims-mark.svg" alt="" className="size-8 dark:hidden" />
            <img src="/brand/protolims-mark-dark.svg" alt="" className="hidden size-8 dark:block" />
            <span className="font-brand text-2xl tracking-tight">
              Proto<span className="font-bold text-primary">LIMS</span>
            </span>
          </Link>
          <nav aria-label="Main" className="flex-1">
            <NavLink
              to="/projects"
              className={({ isActive }) =>
                `rounded-md px-2 py-1.5 text-sm font-medium ${isActive ? 'text-primary' : 'text-muted hover:text-fg'}`
              }
            >
              Projects
            </NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted">
          ProtoLIMS is free software under the{' '}
          <a
            className="text-link underline hover:no-underline"
            href="https://www.gnu.org/licenses/agpl-3.0.html"
          >
            GNU AGPL v3
          </a>
          .{' '}
          <a
            className="text-link underline hover:no-underline"
            href="https://github.com/leehart3000/protolims"
          >
            Source code
          </a>
        </div>
      </footer>
    </div>
  )
}
