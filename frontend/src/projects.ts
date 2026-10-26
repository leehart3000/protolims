// A project's details as the project form sends them. The code is only sent for a new
// project.
export interface ProjectDetails {
  code: string
  name: string
  description: string | null
  source_repository: string | null
  licence: string | null
  citation: string | null
}
