// A column heading that sorts the table: click to sort by it, click again to reverse.
export function SortHeader<S extends string>({
  label,
  ascending,
  descending,
  sort,
  onSort,
  className,
}: {
  label: string
  ascending: S
  descending: S
  sort: S
  onSort: (sort: S) => void
  className: string
}) {
  const direction =
    sort === ascending ? 'ascending' : sort === descending ? 'descending' : undefined

  return (
    <th scope="col" className={className} aria-sort={direction}>
      <button
        type="button"
        className="inline-flex items-center gap-1 uppercase hover:text-fg"
        onClick={() => {
          onSort(sort === ascending ? descending : ascending)
        }}
      >
        {label}
        <span aria-hidden="true" className="w-3 text-primary">
          {direction === 'ascending' ? '▲' : direction === 'descending' ? '▼' : ''}
        </span>
      </button>
    </th>
  )
}
