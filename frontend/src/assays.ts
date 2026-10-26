// An assay's details as the assay form shows them. The date it was performed is a plain date
// (YYYY-MM-DD), as a date box gives it.
export interface AssayFormValues {
  name: string
  measurement_type: string
  technology_type: string
  platform: string | null
  performed_on: string | null
  external_id: string | null
}

// A date without a time is stored as midday UTC, so it shows as the same day in any time zone.
export function performedAt(date: string | null) {
  return date && `${date}T12:00:00Z`
}
