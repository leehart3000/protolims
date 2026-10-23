// Allowed characters for project and study codes (matches the API's rule).
export const codePattern = '[A-Za-z0-9][A-Za-z0-9._\\-]*'

export function text(form: FormData, name: string) {
  return ((form.get(name) as string | null) ?? '').trim()
}

export function optionalText(form: FormData, name: string) {
  return text(form, name) || null
}
