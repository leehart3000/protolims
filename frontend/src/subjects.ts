import type { SubjectType } from './labels'

// A subject's details as the subject form sends them.
export interface SubjectDetails {
  name: string
  subject_type: SubjectType
  species: string | null
  external_id: string | null
}

// The form's starting values. The type is empty ('') until one is chosen for a new subject.
export type SubjectFormValues = Omit<SubjectDetails, 'subject_type'> & {
  subject_type: SubjectType | ''
}
