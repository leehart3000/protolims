import { Link, NavLink, Route, Routes } from 'react-router'

import AccountMenu from './components/AccountMenu'
import ThemeToggle from './components/ThemeToggle'
import { MembersIcon, ProjectIcon, StudyIcon } from './icons'
import { useMe } from './useMe'
import HomePage from './pages/HomePage'
import NewProjectPage from './pages/NewProjectPage'
import NewStudyPage from './pages/NewStudyPage'
import NotFoundPage from './pages/NotFoundPage'
import SignInPage from './pages/SignInPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ProjectsPage from './pages/ProjectsPage'
import StudiesPage from './pages/StudiesPage'
import StudyDetailPage from './pages/StudyDetailPage'
import UsersPage from './pages/UsersPage'
import NewSubjectPage from './pages/NewSubjectPage'
import SubjectDetailPage from './pages/SubjectDetailPage'
import SampleDetailPage from './pages/SampleDetailPage'
import NewSamplePage from './pages/NewSamplePage'
import EditSamplePage from './pages/EditSamplePage'
import EditSubjectPage from './pages/EditSubjectPage'
import EditStudyPage from './pages/EditStudyPage'
import EditProjectPage from './pages/EditProjectPage'
import AssayDetailPage from './pages/AssayDetailPage'
import EditAssayPage from './pages/EditAssayPage'
import NewAssayPage from './pages/NewAssayPage'
import DataFileDetailPage from './pages/DataFileDetailPage'
import EditDataFilePage from './pages/EditDataFilePage'
import NewDataFilePage from './pages/NewDataFilePage'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium ${isActive ? 'text-primary' : 'text-muted hover:text-fg'}`
}

export default function App() {
  const { data: me } = useMe()
  // On a private site (public reading off), nothing can be seen without signing in.
  const mustSignIn = me !== undefined && !me.public_read && me.user === null

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-panel">
        {/* On narrow screens the links go on a second row, so the header never runs off the
            side of the page. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 px-4 py-2 sm:h-16 sm:flex-nowrap sm:gap-6 sm:py-0">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/brand/protolims-mark.svg" alt="" className="size-8 dark:hidden" />
            <img src="/brand/protolims-mark-dark.svg" alt="" className="hidden size-8 dark:block" />
            {/* On narrow screens only the mark shows; the name stays readable by screen readers. */}
            <span className="sr-only font-brand text-2xl tracking-tight sm:not-sr-only">
              Proto<span className="font-bold text-primary">LIMS</span>
            </span>
          </Link>
          <nav
            aria-label="Main"
            className="order-last -mx-2 flex w-full gap-1 sm:order-none sm:mx-0 sm:w-auto sm:flex-1"
          >
            {!mustSignIn && (
              <>
                <NavLink to="/projects" className={navLinkClass}>
                  <ProjectIcon aria-hidden="true" className="size-4 shrink-0" />
                  Projects
                </NavLink>
                <NavLink to="/studies" className={navLinkClass}>
                  <StudyIcon aria-hidden="true" className="size-4 shrink-0" />
                  Studies
                </NavLink>
                {me?.site_admin && (
                  <NavLink to="/users" className={navLinkClass}>
                    <MembersIcon aria-hidden="true" className="size-4 shrink-0" />
                    Users
                  </NavLink>
                )}
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:ml-0">
            <AccountMenu />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10">
        {mustSignIn ? (
          <SignInPage />
        ) : (
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
            <Route
              path="/projects/:code/studies/:studyCode/assays/new"
              element={<NewAssayPage />}
            />
            <Route
              path="/projects/:code/studies/:studyCode/data-files/new"
              element={<NewDataFilePage />}
            />
            <Route path="/subjects/:subjectId" element={<SubjectDetailPage />} />
            <Route path="/subjects/:subjectId/edit" element={<EditSubjectPage />} />
            <Route path="/samples/:sampleId" element={<SampleDetailPage />} />
            <Route path="/samples/:sampleId/edit" element={<EditSamplePage />} />
            <Route path="/assays/:assayId" element={<AssayDetailPage />} />
            <Route path="/assays/:assayId/edit" element={<EditAssayPage />} />
            <Route path="/data-files/:dataFileId" element={<DataFileDetailPage />} />
            <Route path="/data-files/:dataFileId/edit" element={<EditDataFilePage />} />
            <Route path="/studies" element={<StudiesPage />} />
            <Route path="/studies/new" element={<NewStudyPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        )}
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
