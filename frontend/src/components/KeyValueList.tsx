import { DetailList } from './DetailList'

// Flexible key/value data (attributes, characteristics, factor values). Values that aren't
// text, such as numbers or lists, are shown as they'd be written in JSON.
function show(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

export function KeyValueList({
  values,
  emptyText,
}: {
  values: Record<string, unknown>
  emptyText: string
}) {
  const entries = Object.entries(values)
  if (entries.length === 0) {
    return <p className="mt-4 text-muted">{emptyText}</p>
  }
  return <DetailList items={entries.map(([key, value]): [string, string] => [key, show(value)])} />
}
