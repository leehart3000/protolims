import { fetchAllAssayPage, type AssaySort } from '../api/queries'
import type { components } from '../api/schema'
import { AllRecordsList } from '../components/AllRecordsList'
import { AssayTable } from '../components/AssayTable'
import { AssayIcon } from '../icons'

type Item = components['schemas']['AssayRead']

export default function AssaysPage() {
  return (
    <AllRecordsList<AssaySort, Item>
      icon={AssayIcon}
      one="assay"
      noun="assays"
      queryKey="assays"
      initialSort="name"
      fetchPage={fetchAllAssayPage}
      placeholder="Search by name or external ID"
      renderTable={(items, sort, onSort) => (
        <AssayTable assays={items} sort={sort} onSort={onSort} showStudy />
      )}
    />
  )
}
