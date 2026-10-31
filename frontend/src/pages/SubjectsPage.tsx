import { fetchAllSubjectPage, type SubjectSort } from '../api/queries'
import type { components } from '../api/schema'
import { AllRecordsList } from '../components/AllRecordsList'
import { SubjectTable } from '../components/SubjectTable'
import { SubjectIcon } from '../icons'

type Item = components['schemas']['SubjectRead']

export default function SubjectsPage() {
  return (
    <AllRecordsList<SubjectSort, Item>
      icon={SubjectIcon}
      one="subject"
      noun="subjects"
      queryKey="subjects"
      initialSort="name"
      fetchPage={fetchAllSubjectPage}
      placeholder="Search by name or external ID"
      renderTable={(items, sort, onSort) => (
        <SubjectTable subjects={items} sort={sort} onSort={onSort} showStudy />
      )}
    />
  )
}
