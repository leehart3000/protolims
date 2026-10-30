import { fetchAllSubjectPage, type SubjectSort } from '../api/queries'
import type { components } from '../api/schema'
import { AllRecordsList } from '../components/AllRecordsList'
import { PageTitle } from '../components/PageTitle'
import { SubjectTable } from '../components/SubjectTable'
import { SubjectIcon } from '../icons'

type Item = components['schemas']['SubjectRead']

export default function SubjectsPage() {
  return (
    <>
      <PageTitle icon={SubjectIcon}>Subjects</PageTitle>
      <p className="mt-2 text-muted">
        Every subject in the studies you can see. To add one, go to its study.
      </p>
      <AllRecordsList<SubjectSort, Item>
        kind="subjects"
        queryKey="subjects"
        initialSort="name"
        fetchPage={fetchAllSubjectPage}
        placeholder="Search by name or external ID"
        renderTable={(items, sort, onSort) => (
          <SubjectTable subjects={items} sort={sort} onSort={onSort} showStudy />
        )}
      />
    </>
  )
}
