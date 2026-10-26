import type { components } from './api/schema'

export type DesignFactor = components['schemas']['DesignFactor']

// A study's details as the study form sends them. The code is only sent for a new study.
export interface StudyDetails {
  code: string
  title: string
  description: string | null
  design_factors: DesignFactor[]
}
