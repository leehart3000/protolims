import { useQuery } from '@tanstack/react-query'

import { fetchAllStudyPage, fetchProjectPage } from '../api/queries'
import { inputClass } from '../styles'
import { FieldLabel } from './FormFields'

interface Option {
  value: string
  label: string
}

// The options, with the chosen one added if it isn't among them (say, while they load).
function withChosen(options: Option[], chosen: string | undefined) {
  if (chosen === undefined || options.some((option) => option.value === chosen)) {
    return options
  }
  return [{ value: chosen, label: chosen }, ...options]
}

function FilterSelect({
  id,
  label,
  all,
  options,
  value,
  disabled = false,
  onChange,
}: {
  id: string
  label: string
  all: string
  options: Option[]
  value: string | undefined
  disabled?: boolean
  onChange: (value: string | undefined) => void
}) {
  return (
    <div className="min-w-48 flex-1 sm:max-w-xs">
      <FieldLabel htmlFor={id} label={label} />
      <select
        id={id}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value || undefined)
        }}
        className={`${inputClass} border-line disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <option value="">{all}</option>
        {withChosen(options, value).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// Choosing a project, then one of its studies, to list only their records. The choices are
// the projects and studies someone can see; if they can't be loaded, only "All" is offered
// (with whatever was chosen), as the list itself says if something's wrong.
export function RecordFilters({
  project,
  study,
  onChange,
}: {
  project: string | undefined
  study: string | undefined
  onChange: (project: string | undefined, study: string | undefined) => void
}) {
  const projects = useQuery({
    queryKey: ['projects', { sort: 'code', limit: 500 }],
    queryFn: () => fetchProjectPage({ sort: 'code', limit: 500, offset: 0 }),
  })
  const studies = useQuery({
    queryKey: ['studies', { project, sort: 'code', limit: 500 }],
    queryFn: () => fetchAllStudyPage({ project, sort: 'code', limit: 500, offset: 0 }),
    enabled: project !== undefined,
  })

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <FilterSelect
        id="project-filter"
        label="Project"
        all="All projects"
        options={(projects.data?.items ?? []).map((item) => ({
          value: item.code,
          label: `${item.code} · ${item.name}`,
        }))}
        value={project}
        onChange={(value) => {
          onChange(value, undefined)
        }}
      />
      <FilterSelect
        id="study-filter"
        label="Study"
        all={project === undefined ? 'Choose a project first' : 'All studies'}
        options={
          project === undefined
            ? []
            : (studies.data?.items ?? []).map((item) => ({
                value: item.code,
                label: `${item.code} · ${item.title}`,
              }))
        }
        value={study}
        disabled={project === undefined}
        onChange={(value) => {
          onChange(project, value)
        }}
      />
    </div>
  )
}
