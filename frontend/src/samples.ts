import type { SampleStatus } from './labels'

// A sample's details as the sample form shows them. The collection date is a plain date
// (YYYY-MM-DD), as a date box gives it.
export interface SampleFormValues {
  name: string
  material_type: string
  status: SampleStatus
  subject_id: string | null
  parent_sample_id: string | null
  collected_on: string | null
  external_id: string | null
}

// A date without a time is stored as midday UTC, so it shows as the same day in any time zone.
export function collectedAt(date: string | null) {
  return date && `${date}T12:00:00Z`
}
