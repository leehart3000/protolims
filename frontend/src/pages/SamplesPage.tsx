import { fetchAllSamplePage, type SampleSort } from '../api/queries'
import type { components } from '../api/schema'
import { AllRecordsList } from '../components/AllRecordsList'
import { SampleTable } from '../components/SampleTable'
import { SampleIcon } from '../icons'

type Item = components['schemas']['SampleRead']

export default function SamplesPage() {
  return (
    <AllRecordsList<SampleSort, Item>
      icon={SampleIcon}
      one="sample"
      noun="samples"
      queryKey="samples"
      initialSort="name"
      fetchPage={fetchAllSamplePage}
      placeholder="Search by name or external ID"
      renderTable={(items, sort, onSort) => (
        <SampleTable samples={items} label="Samples" sort={sort} onSort={onSort} showStudy />
      )}
    />
  )
}
