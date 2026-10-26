import { Link, NavLink, Route, Routes } from 'react-router'

import ThemeToggle from './components/ThemeToggle'
import HomePage from './pages/HomePage'
import NewProjectPage from './pages/NewProjectPage'
import NewStudyPage from './pages/NewStudyPage'
import NotFoundPage from './pages/NotFoundPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ProjectsPage from './pages/ProjectsPage'
import StudiesPage from './pages/StudiesPage'
import StudyDetailPage from './pages/StudyDetailPage'
import NewSubjectPage from './pages/NewSubjectPage'
import SubjectDetailPage from './pages/SubjectDetailPage'
import SampleDetailPage from './pages/SampleDetailPage'
import NewSamplePage from './pages/NewSamplePage'
import EditSamplePage from './pages/EditSamplePage'
import EditSubjectPage from './pages/EditSubjectPage'
import EditStudyPage from './pages/EditStudyPage'
import EditProjectPage from './pages/EditProjectPage'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `rounded-md px-2 py-1.5 text-sm font-medium ${isActive ? 'text-primary' : 'text-muted hover:text-fg'}`
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/brand/protolims-mark.svg" alt="" className="size-8 dark:hidden" />
            <img src="/brand/protolims-mark-dark.svg" alt="" className="hidden size-8 dark:block" />
            {/* On narrow screens only the mark shows; the name stays readable by screen readers. */}
            <span className="sr-only font-brand text-2xl tracking-tight sm:not-sr-only">
              Proto<span className="font-bold text-primary">LIMS</span>
            </span>
          </Link>
          <nav aria-label="Main" className="flex flex-1 gap-1">
            <NavLink to="/projects" className={navLinkClass}>
              Projects
            </NavLink>
            <NavLink to="/studies" className={navLinkClass}>
              Studies
            </NavLink>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<NewProjectPage />} />
          <Route path="/projects/:code" element={<ProjectDetailPage />} />
          <Route path="/projects/:code/edit" element={<EditProjectPage />} />
          <Route path="/projects/:code/studies/new" element={<NewStudyPage />} />
          <Route path="/projects/:code/studies/:studyCode" element={<StudyDetailPage />} />
          <Route path="/projects/:code/studies/:studyCode/edit" element={<EditStudyPage />} />
          <Route
            path="/projects/:code/studies/:studyCode/subjects/new"
            element={<NewSubjectPage />}
          />
          <Route
            path="/projects/:code/studies/:studyCode/samples/new"
            element={<NewSamplePage />}
          />
          <Route path="/subjects/:subjectId" element={<SubjectDetailPage />} />
          <Route path="/subjects/:subjectId/edit" element={<EditSubjectPage />} />
          <Route path="/samples/:sampleId" element={<SampleDetailPage />} />
          <Route path="/samples/:sampleId/edit" element={<EditSamplePage />} />
          <Route path="/studies" element={<StudiesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted">
          <p>
            ProtoLIMS is{' '}
            <a
              className="text-link underline hover:no-underline"
              href="https://github.com/leehart3000/protolims"
            >
              free software
            </a>{' '}
            under the{' '}
            <a
              className="text-link underline hover:no-underline"
              href="https://www.gnu.org/licenses/agpl-3.0.html"
            >
              GNU AGPL v3
            </a>
            .
          </p>
          <p>
            Version {import.meta.env.VITE_APP_VERSION}/{import.meta.env.VITE_APP_COMMIT}
          </p>
        </div>
      </footer>
    </div>
  )
}
