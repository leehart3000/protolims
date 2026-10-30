import { fetchAllAssayPage, type AssaySort } from '../api/queries'
import type { components } from '../api/schema'
import { AllRecordsList } from '../components/AllRecordsList'
import { PageTitle } from '../components/PageTitle'
import { AssayTable } from '../components/AssayTable'
import { AssayIcon } from '../icons'

type Item = components['schemas']['AssayRead']

export default function AssaysPage() {
  return (
    <>
      <PageTitle icon={AssayIcon}>Assays</PageTitle>
      <p className="mt-2 text-muted">
        Every assay in the studies you can see. To add one, go to its study.
      </p>
      <AllRecordsList<AssaySort, Item>
        kind="assays"
        queryKey="assays"
        initialSort="name"
        fetchPage={fetchAllAssayPage}
        placeholder="Search by name or external ID"
        renderTable={(items, sort, onSort) => (
          <AssayTable assays={items} sort={sort} onSort={onSort} showStudy />
        )}
      />
    </>
  )
}
