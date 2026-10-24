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

export type SampleStatus = NonNullable<components['schemas']['SampleCreate']['status']>

export const sampleStatusOptions: { value: SampleStatus; label: string }[] = [
  { value: 'registered', label: 'Registered' },
  { value: 'received', label: 'Received' },
  { value: 'in_storage', label: 'In storage' },
  { value: 'in_use', label: 'In use' },
  { value: 'consumed', label: 'Consumed' },
  { value: 'disposed', label: 'Disposed' },
]

export function sampleStatusLabel(status: string) {
  return sampleStatusOptions.find((option) => option.value === status)?.label ?? status
}
