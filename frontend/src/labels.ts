import type { components } from './api/schema'

export type SubjectType = components['schemas']['SubjectCreate']['subject_type']

export const subjectTypeOptions: { value: SubjectType; label: string }[] = [
  { value: 'patient', label: 'Patient' },
  { value: 'cell_line', label: 'Cell line' },
  { value: 'organism', label: 'Organism' },
  { value: 'other', label: 'Other' },
]

export function subjectTypeLabel(type: string) {
  return subjectTypeOptions.find((option) => option.value === type)?.label ?? type
}
