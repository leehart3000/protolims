import type { DataFileLevel } from './labels'

// A data file's details as the data file form shows them.
export interface DataFileFormValues {
  name: string
  uri: string
  level: DataFileLevel
  format: string
  assay_id: string | null
  size_bytes: number | null
  sha256: string | null
  external_id: string | null
}

// Thrown when a location is already recorded in the study, so the form can highlight it.
export class DuplicateLocationError extends Error {}

const GENERIC = 'Some of the details are not valid. Please check them and try again.'
const VALUE_ERROR = 'Value error, '

// The API's own explanations (such as why a location isn't allowed) start "Value error, ";
// other problems are technical, so they get a general message instead.
function valueErrorMessage(item: unknown): string[] {
  const message = typeof item === 'object' && item !== null && 'msg' in item ? item.msg : undefined
  return typeof message === 'string' && message.startsWith(VALUE_ERROR)
    ? [`${message.slice(VALUE_ERROR.length)}.`]
    : []
}

// What to tell the user when the API rejects a data file's details (422). A broken rule, such
// as an assay from another study, is explained in words; invalid details come back as a list.
export function invalidDetailsMessage(error: unknown) {
  const detail =
    typeof error === 'object' && error !== null && 'detail' in error ? error.detail : undefined
  if (typeof detail === 'string') {
    return detail
  }
  const explained = Array.isArray(detail) ? detail.flatMap(valueErrorMessage) : []
  return explained.length > 0 ? explained.join(' ') : GENERIC
}
