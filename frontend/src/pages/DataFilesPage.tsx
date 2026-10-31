import { fetchAllDataFilePage, type DataFileSort } from '../api/queries'
import type { components } from '../api/schema'
import { AllRecordsList } from '../components/AllRecordsList'
import { DataFileTable } from '../components/DataFileTable'
import { DataFileIcon } from '../icons'

type Item = components['schemas']['DataFileRead']

export default function DataFilesPage() {
  return (
    <AllRecordsList<DataFileSort, Item>
      icon={DataFileIcon}
      one="data file"
      noun="data files"
      queryKey="data-files"
      initialSort="name"
      fetchPage={fetchAllDataFilePage}
      placeholder="Search by name, external ID or location"
      renderTable={(items, sort, onSort) => (
        <DataFileTable files={items} sort={sort} onSort={onSort} showStudy />
      )}
    />
  )
}
