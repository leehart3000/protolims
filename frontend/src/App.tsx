import type { LucideIcon } from 'lucide-react'
import { Link, NavLink, Route, Routes } from 'react-router'

import AccountMenu from './components/AccountMenu'
import { EnvironmentBadge } from './components/EnvironmentBadge'
import ThemeToggle from './components/ThemeToggle'
import {
  AssayIcon,
  DataFileIcon,
  MembersIcon,
  ProjectIcon,
  SampleIcon,
  StudyIcon,
  SubjectIcon,
} from './icons'
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
import SubjectsPage from './pages/SubjectsPage'
import SamplesPage from './pages/SamplesPage'
import AssaysPage from './pages/AssaysPage'
import DataFilesPage from './pages/DataFilesPage'
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

// The main links: a row of tabs under the header on every screen. On narrow screens they show
// only their icons, so there's room for them all; their names stay readable by screen readers.
const NAV_LINKS: { to: string; label: string; icon: LucideIcon; siteAdminOnly?: boolean }[] = [
  { to: '/projects', label: 'Projects', icon: ProjectIcon },
  { to: '/studies', label: 'Studies', icon: StudyIcon },
  { to: '/subjects', label: 'Subjects', icon: SubjectIcon },
  { to: '/samples', label: 'Samples', icon: SampleIcon },
  { to: '/assays', label: 'Assays', icon: AssayIcon },
  { to: '/data-files', label: 'Data files', icon: DataFileIcon },
  { to: '/users', label: 'Users', icon: MembersIcon, siteAdminOnly: true },
]

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-sm font-medium md:px-3 ${isActive ? 'border-primary text-primary' : 'border-transparent text-muted hover:border-gold hover:text-fg dark:hover:text-gold'}`
}

export default function App() {
  const { data: me } = useMe()
  // On a private site (public reading off), nothing can be seen without signing in.
  const mustSignIn = me !== undefined && !me.public_read && me.user === null

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:h-16 sm:gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/brand/protolims-mark.svg" alt="" className="size-8 dark:hidden" />
            <img src="/brand/protolims-mark-dark.svg" alt="" className="hidden size-8 dark:block" />
            <span className="font-brand text-xl tracking-tight sm:text-2xl">
              Proto<span className="font-bold text-primary">LIMS</span>
            </span>
          </Link>
          <EnvironmentBadge />
          <div className="ml-auto flex items-center gap-1">
            <AccountMenu />
            <ThemeToggle />
          </div>
        </div>
        {!mustSignIn && (
          <nav aria-label="Main" className="border-t border-line">
            <div className="mx-auto flex max-w-6xl justify-between px-2 md:justify-start md:gap-1">
              {NAV_LINKS.filter((link) => !link.siteAdminOnly || me?.site_admin).map(
                ({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} className={navLinkClass}>
                    <Icon aria-hidden="true" className="size-5 shrink-0 md:size-4" />
                    <span className="max-md:sr-only">{label}</span>
                  </NavLink>
                ),
              )}
            </div>
          </nav>
        )}
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
            <Route path="/subjects" element={<SubjectsPage />} />
            <Route path="/samples" element={<SamplesPage />} />
            <Route path="/assays" element={<AssaysPage />} />
            <Route path="/data-files" element={<DataFilesPage />} />
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
