import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'

import { RECORD_KIND_LABELS, type RecordKind } from '../recordLists'
import { errorBox, textLink } from '../styles'
import { useListControls } from '../useListControls'
import { Breadcrumbs } from './Breadcrumbs'
import { PagedTable } from './PagedTable'
import { PageTitle } from './PageTitle'
import { RecordFilters } from './RecordFilters'
import { SearchBox } from './SearchBox'

interface PageQuery<S> {
  project?: string
  study?: string
  q?: string
  sort: S
  limit: number
  offset: number
}

interface ListProps<S, T> {
  // The plural, in lower case, as in "No subjects yet".
  noun: string
  queryKey: RecordKind
  initialSort: S
  fetchPage: (query: PageQuery<S>) => Promise<{ items: T[]; total: number }>
  placeholder: string
  renderTable: (items: T[], sort: S, onSort: (sort: S) => void) => ReactNode
}

function projectPath(project: string) {
  return `/projects/${encodeURIComponent(project)}`
}

function studyPath(project: string, study: string) {
  return `${projectPath(project)}/studies/${encodeURIComponent(study)}`
}

// Where the list is: from the project, and its study, when it's filtered to them.
function trail(label: string, project: string, study: string | undefined) {
  return [
    { label: 'Projects', to: '/projects' },
    { label: project, to: projectPath(project), mono: true },
    ...(study === undefined
      ? []
      : [
          { label: 'Studies', to: `/studies?project=${encodeURIComponent(project)}` },
          { label: study, to: studyPath(project, study), mono: true },
        ]),
    { label },
  ]
}

// What's listed, and where to add more, as in "Every assay in study MULTIOMICS of project
// CPTAC-3. To add one, go to the study."
function Description({ one, project, study }: { one: string; project?: string; study?: string }) {
  if (project === undefined) {
    return <>Every {one} in the studies you can see. To add one, go to its study.</>
  }
  if (study === undefined) {
    return (
      <>
        Every {one} in the studies of project <span className="font-mono">{project}</span> that you
        can see. To add one, go to its study.
      </>
    )
  }
  return (
    <>
      Every {one} in study <span className="font-mono">{study}</span> of project{' '}
      <span className="font-mono">{project}</span>. To add one, go to{' '}
      <Link to={studyPath(project, study)} className={textLink}>
        the study
      </Link>
      .
    </>
  )
}

function RecordList<S extends string, T>({
  noun,
  queryKey,
  initialSort,
  fetchPage,
  placeholder,
  renderTable,
  project,
  study,
}: ListProps<S, T> & { project?: string; study?: string }) {
  const controls = useListControls<S>(initialSort)
  const { search, q, sort, offset, limit, changeSearch, changeSort } = controls
  const query = useQuery({
    // Under the kind's own key, so saving a record of this kind refreshes the list too.
    queryKey: [queryKey, 'all', { project, study, q, sort, offset, limit }],
    queryFn: () => fetchPage({ project, study, q: q || undefined, sort, limit, offset }),
    placeholderData: keepPreviousData,
  })

  if (query.isPending) {
    return <p className="mt-6 text-muted">Loading {noun}…</p>
  }

  if (query.isError) {
    return (
      <p role="alert" className={`mt-6 ${errorBox}`}>
        Could not load {noun}. Please try again later.
      </p>
    )
  }

  const { items, total } = query.data

  return (
    <>
      {(total > 0 || q !== '') && (
        <SearchBox
          id={`${queryKey}-search`}
          label={`Search ${noun}`}
          placeholder={placeholder}
          value={search}
          onChange={changeSearch}
        />
      )}
      {total === 0 ? (
        <p className="mt-6 text-muted">{q ? `No ${noun} match “${q}”.` : `No ${noun} yet.`}</p>
      ) : (
        <PagedTable total={total} controls={controls}>
          {renderTable(items, sort, changeSort)}
        </PagedTable>
      )}
    </>
  )
}

// The page of every record of one kind (subjects, say) in the studies someone can see, a page
// at a time, with sorting and search, and filters by project and study. The filters are in
// the page's address (as in /assays?project=CPTAC-3&study=MULTIOMICS), so a filtered list can
// be bookmarked or linked to; a study is only used with its project. `one` is the singular,
// as in "Every assay".
export function AllRecordsList<S extends string, T>({
  icon,
  one,
  ...list
}: ListProps<S, T> & { icon: LucideIcon; one: string }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const project = searchParams.get('project') ?? undefined
  const study = project === undefined ? undefined : (searchParams.get('study') ?? undefined)
  const title = RECORD_KIND_LABELS[list.queryKey]

  return (
    <>
      {project !== undefined && <Breadcrumbs items={trail(title, project, study)} />}
      <PageTitle icon={icon}>{title}</PageTitle>
      <p className="mt-2 text-muted">
        <Description one={one} project={project} study={study} />
      </p>
      <RecordFilters
        project={project}
        study={study}
        onChange={(nextProject, nextStudy) => {
          const next = new URLSearchParams()
          if (nextProject !== undefined) {
            next.set('project', nextProject)
            if (nextStudy !== undefined) {
              next.set('study', nextStudy)
            }
          }
          setSearchParams(next)
        }}
      />
      {/* A new filter starts the list afresh, from its first page. */}
      <RecordList<S, T>
        key={`${project ?? ''}/${study ?? ''}`}
        {...list}
        project={project}
        study={study}
      />
    </>
  )
}
