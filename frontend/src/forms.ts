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
