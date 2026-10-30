import { fetchAllSamplePage, type SampleSort } from '../api/queries'
import type { components } from '../api/schema'
import { AllRecordsList } from '../components/AllRecordsList'
import { PageTitle } from '../components/PageTitle'
import { SampleTable } from '../components/SampleTable'
import { SampleIcon } from '../icons'

type Item = components['schemas']['SampleRead']

export default function SamplesPage() {
  return (
    <>
      <PageTitle icon={SampleIcon}>Samples</PageTitle>
      <p className="mt-2 text-muted">
        Every sample in the studies you can see. To add one, go to its study.
      </p>
      <AllRecordsList<SampleSort, Item>
        kind="samples"
        queryKey="samples"
        initialSort="name"
        fetchPage={fetchAllSamplePage}
        placeholder="Search by name or external ID"
        renderTable={(items, sort, onSort) => (
          <SampleTable samples={items} label="Samples" sort={sort} onSort={onSort} showStudy />
        )}
      />
    </>
  )
}
