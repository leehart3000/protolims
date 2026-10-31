import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { DeleteIcon } from '../icons'
import { refusalReason, roleOn } from '../permissions'
import { dangerButton, errorBox, secondaryButton } from '../styles'
import { useMe } from '../useMe'
import { DisabledButton } from './DisabledButton'
import { SectionHeading } from './SectionHeading'

// Deleting a study or project, at the bottom of its page. Shown only to those who could
// create one there (a project's admins for a study, site administrators for a project), as
// for the Members section; greyed out, with the reason, while the site is read-only. It's
// confirmed first; the API says why if it isn't empty. Afterwards, it goes to `deletedTo`.
export function DeleteSection({
  noun,
  name,
  need,
  explanation,
  onDelete,
  deletedTo,
}: {
  noun: 'study' | 'project'
  name: string
  need: { siteAdmin: true } | { role: 'admin'; project: string }
  explanation: string
  onDelete: () => Promise<void>
  deletedTo: string
}) {
  const { data: me } = useMe()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const deleting = useMutation({
    mutationFn: onDelete,
    onSuccess: async () => {
      // Leave its page first, so it isn't fetched again (and not found) on the way out. Then
      // it's gone from the lists of projects and studies, and is in your changes.
      await navigate(deletedTo)
      await Promise.all(
        ['projects', 'studies', 'activity'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      )
    },
  })

  if (me === undefined) {
    return null
  }
  const allowed = 'siteAdmin' in need ? me.site_admin : roleOn(me, need.project) === 'admin'
  if (!allowed) {
    return null
  }
  const reason = refusalReason(me, need)
  const label = `Delete ${noun}`

  return (
    <section className="mt-10">
      <SectionHeading icon={DeleteIcon}>Delete this {noun}</SectionHeading>
      <p className="mt-2 max-w-3xl text-muted">{explanation}</p>
      <div className="mt-4">
        {reason ? (
          <DisabledButton icon={DeleteIcon} className={dangerButton} reason={reason} align="start">
            {label}
          </DisabledButton>
        ) : (
          <button
            type="button"
            aria-expanded={confirming}
            disabled={deleting.isPending}
            onClick={() => {
              setConfirming(true)
            }}
            className={`${dangerButton} inline-flex items-center gap-2`}
          >
            <DeleteIcon aria-hidden="true" className="size-4 shrink-0" />
            {label}
          </button>
        )}
      </div>
      {confirming && (
        <div className="mt-4 flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-danger-bg p-4">
          <p className="text-sm font-medium text-danger">
            Delete {noun} “{name}”? This can’t be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={deleting.isPending}
              onClick={() => {
                deleting.mutate()
              }}
              className={dangerButton}
            >
              {deleting.isPending ? 'Deleting…' : 'Yes, delete'}
            </button>
            {/* Focus starts on Cancel, the safe choice. */}
            <button
              type="button"
              autoFocus
              onClick={() => {
                setConfirming(false)
                deleting.reset()
              }}
              className={secondaryButton}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {deleting.isError && (
        <p role="alert" className={`mt-4 max-w-3xl ${errorBox}`}>
          {deleting.error.message}
        </p>
      )}
    </section>
  )
}
