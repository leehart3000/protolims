import { fetchAllDataFilePage, type DataFileSort } from '../api/queries'
import type { components } from '../api/schema'
import { AllRecordsList } from '../components/AllRecordsList'
import { PageTitle } from '../components/PageTitle'
import { DataFileTable } from '../components/DataFileTable'
import { DataFileIcon } from '../icons'

type Item = components['schemas']['DataFileRead']

export default function DataFilesPage() {
  return (
    <>
      <PageTitle icon={DataFileIcon}>Data files</PageTitle>
      <p className="mt-2 text-muted">
        Every data file in the studies you can see. To add one, go to its study.
      </p>
      <AllRecordsList<DataFileSort, Item>
        kind="data files"
        queryKey="data-files"
        initialSort="name"
        fetchPage={fetchAllDataFilePage}
        placeholder="Search by name, external ID or location"
        renderTable={(items, sort, onSort) => (
          <DataFileTable files={items} sort={sort} onSort={onSort} showStudy />
        )}
      />
    </>
  )
}
