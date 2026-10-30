import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import {
  fetchAllAssayPage,
  fetchAllDataFilePage,
  fetchAllSamplePage,
  fetchAllStudyPage,
  fetchAllSubjectPage,
  fetchProjectPage,
} from '../api/queries'
import { AssayIcon, DataFileIcon, ProjectIcon, SampleIcon, StudyIcon, SubjectIcon } from '../icons'

// Each kind of record (named for one of them too, as in "1 Assay"), with how to count the ones
// someone can see: the total from a one-item page of its list.
const KINDS: {
  label: string
  one: string
  to: string
  icon: LucideIcon
  queryKey: string
  count: () => Promise<{ total: number }>
}[] = [
  {
    label: 'Projects',
    one: 'Project',
    to: '/projects',
    icon: ProjectIcon,
    queryKey: 'projects',
    count: () => fetchProjectPage({ limit: 1 }),
  },
  {
    label: 'Studies',
    one: 'Study',
    to: '/studies',
    icon: StudyIcon,
    queryKey: 'studies',
    count: () => fetchAllStudyPage({ limit: 1 }),
  },
  {
    label: 'Subjects',
    one: 'Subject',
    to: '/subjects',
    icon: SubjectIcon,
    queryKey: 'subjects',
    count: () => fetchAllSubjectPage({ limit: 1 }),
  },
  {
    label: 'Samples',
    one: 'Sample',
    to: '/samples',
    icon: SampleIcon,
    queryKey: 'samples',
    count: () => fetchAllSamplePage({ limit: 1 }),
  },
  {
    label: 'Assays',
    one: 'Assay',
    to: '/assays',
    icon: AssayIcon,
    queryKey: 'assays',
    count: () => fetchAllAssayPage({ limit: 1 }),
  },
  {
    label: 'Data files',
    one: 'Data file',
    to: '/data-files',
    icon: DataFileIcon,
    queryKey: 'data-files',
    count: () => fetchAllDataFilePage({ limit: 1 }),
  },
]

// A card linking to one kind of record's page, with how many there are, as in "213 Subjects"
// (wrapping only if it must). Until the count arrives (or if it can't be loaded), a dash stands
// in for it.
function KindCard({ kind }: { kind: (typeof KINDS)[number] }) {
  const { label, one, to, icon: Icon, queryKey, count } = kind
  // Under the kind's own key, so saving a record of this kind refreshes the count too.
  const query = useQuery({ queryKey: [queryKey, { count: true }], queryFn: count })

  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-3 rounded-lg border border-line bg-panel p-4 text-lg font-semibold hover:border-gold hover:bg-gold/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
      >
        <Icon aria-hidden="true" className="size-6 shrink-0 text-primary" />
        <span>
          <span className="tabular-nums">
            {query.data === undefined ? '–' : query.data.total.toLocaleString('en-GB')}
          </span>{' '}
          {query.data?.total === 1 ? one : label}
        </span>
      </Link>
    </li>
  )
}

export default function HomePage() {
  return (
    <>
      <h1 className="font-brand text-2xl tracking-tight sm:text-3xl">
        <span className="text-fg">Welcome to Proto</span>
        <span className="font-bold">LIMS</span>
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        A prototype laboratory information management system for multi-omics research: samples,
        experiments, assays and results, with full provenance.
      </p>
      <ul aria-label="What's here" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {KINDS.map((kind) => (
          <KindCard key={kind.to} kind={kind} />
        ))}
      </ul>
    </>
  )
}
