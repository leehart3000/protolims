// Allowed project and study codes (matches the API's rule): letters, digits, dots, dashes and
// underscores, starting with a letter or digit. "new" and "edit", in any capitalisation, are
// reserved because they would clash with page addresses such as /projects/new.
export const codePattern = '(?!(?:[Nn][Ee][Ww]|[Ee][Dd][Ii][Tt])$)[A-Za-z0-9][A-Za-z0-9._\\-]*'

// Allowed subject (and later sample) names: anything except slashes, with no spaces at
// either end (matches the API's rule).
export const namePattern = '[^\\/\\s](?:[^\\/]*[^\\/\\s])?'

export function text(form: FormData, name: string) {
  return ((form.get(name) as string | null) ?? '').trim()
}

export function optionalText(form: FormData, name: string) {
  return text(form, name) || null
}

// Thrown when a name is already used, so the form can highlight the Name field.
export class DuplicateNameError extends Error {}

// Thrown when a code is already used, so the form can highlight the Code field.
export class DuplicateCodeError extends Error {}

// Thrown when an external ID is already used in the study, so the form can highlight it.
export class DuplicateExternalIdError extends Error {}

// The API's 409 reply starts "External ID" when the clash is over the external ID, rather
// than the name (or a data file's location).
export function isExternalIdConflict(error: unknown) {
  const detail =
    typeof error === 'object' && error !== null && 'detail' in error ? error.detail : undefined
  return typeof detail === 'string' && detail.startsWith('External ID')
}

// The message for a form's External ID field, if the error is about it.
export function externalIdError(error: Error | null) {
  return error instanceof DuplicateExternalIdError
    ? 'This external ID is already used in this study.'
    : undefined
}

// The error to show when the API refuses a change for a reason the form can't fix: nobody is
// signed in (401), they don't have permission (403), the site is read-only (423), or something
// unexpected (`otherwise`).
export function refusal(status: number, otherwise: string) {
  if (status === 423) {
    return new Error('Nothing was saved, because this site is read-only at the moment.')
  }
  if (status === 401) {
    return new Error(
      "Nothing was saved, because you're not signed in. Sign in (top right), then try again.",
    )
  }
  if (status === 403) {
    return new Error(
      "Nothing was saved, because you don't have permission to do this. If you think you should, ask an administrator.",
    )
  }
  return new Error(otherwise)
}
