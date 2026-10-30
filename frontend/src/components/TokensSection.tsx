import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { fetchApiTokens } from '../api/queries'
import type { components } from '../api/schema'
import { formatDate } from '../format'
import { text } from '../forms'
import { TokenIcon } from '../icons'
import {
  dangerButton,
  errorBox,
  primaryButton,
  secondaryButton,
  table,
  tableCell,
  tableHead,
  tableHeader,
  tableWrapper,
} from '../styles'
import { createToken, revokeToken, TOKEN_LIFETIMES } from '../tokens'
import { SelectField, TextField } from './FormFields'
import { SectionHeading } from './SectionHeading'

type Token = components['schemas']['ApiTokenRead']
type NewToken = components['schemas']['ApiTokenCreated']

// A token just made: shown this once, with a way to copy it.
function NewTokenBox({ token, onDone }: { token: NewToken; onDone: () => void }) {
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null)

  return (
    <div role="status" className="mt-4 rounded-lg border border-gold bg-gold/15 p-4">
      <p className="font-medium">
        Your new token, “{token.name}”. Copy it now and keep it somewhere safe, such as a password
        manager: you won&rsquo;t be able to see it again.
      </p>
      <p className="mt-3 rounded-md border border-line bg-panel px-3 py-2 font-mono text-sm break-all">
        {token.token}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(token.token).then(
              () => {
                setCopied('yes')
              },
              () => {
                setCopied('failed')
              },
            )
          }}
          className={secondaryButton}
        >
          Copy
        </button>
        <button type="button" onClick={onDone} className={secondaryButton}>
          Done
        </button>
        {copied === 'yes' && <span className="text-sm text-muted">Copied.</span>}
        {copied === 'failed' && (
          <span className="text-sm text-danger">
            Couldn&rsquo;t copy it: please select it and copy it.
          </span>
        )}
      </div>
    </div>
  )
}

function TokenRow({ token, now }: { token: Token; now: Date }) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const revoking = useMutation({
    mutationFn: () => revokeToken(token.id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['api-tokens'] }),
        queryClient.invalidateQueries({ queryKey: ['activity'] }),
      ]),
  })
  const expired = new Date(token.expires_at) <= now

  return (
    <>
      <tr>
        <td className={tableCell}>
          <span className="font-medium">{token.name}</span>
          <p className="mt-1 font-mono text-xs text-muted">{token.hint}…</p>
        </td>
        <td className={`${tableCell} hidden sm:table-cell`}>{formatDate(token.created_at)}</td>
        <td className={tableCell}>
          {expired ? (
            <span className="font-medium text-danger">Expired</span>
          ) : (
            formatDate(token.expires_at)
          )}
          <p className="mt-1 text-xs text-muted">
            Last used: {token.last_used_at ? formatDate(token.last_used_at) : 'never'}
          </p>
        </td>
        <td className={`${tableCell} w-px`}>
          <button
            type="button"
            aria-label={`Revoke ${token.name}`}
            aria-expanded={confirming}
            disabled={revoking.isPending}
            onClick={() => {
              setConfirming(true)
            }}
            className={secondaryButton}
          >
            Revoke
          </button>
        </td>
      </tr>
      {confirming && (
        <tr>
          <td colSpan={4} className={`${tableCell} bg-danger-bg`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-sm font-medium text-danger">
                Revoke “{token.name}”? Anything using it will stop working.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={revoking.isPending}
                  onClick={() => {
                    revoking.mutate()
                  }}
                  className={dangerButton}
                >
                  Yes, revoke
                </button>
                {/* Focus starts on Cancel, the safe choice. */}
                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    setConfirming(false)
                  }}
                  className={secondaryButton}
                >
                  Cancel
                </button>
              </div>
            </div>
            {revoking.isError && (
              <p role="alert" className="mt-2 text-sm font-medium text-danger">
                {revoking.error.message}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function TokenList() {
  const query = useQuery({ queryKey: ['api-tokens'], queryFn: fetchApiTokens })

  if (query.isPending) {
    return <p className="mt-3 text-muted">Loading your API tokens…</p>
  }
  if (query.isError) {
    return (
      <p role="alert" className={`mt-3 ${errorBox}`}>
        Could not load your API tokens. Please try again later.
      </p>
    )
  }
  if (query.data.length === 0) {
    return <p className="mt-4 text-muted">You have no API tokens.</p>
  }

  const now = new Date()
  return (
    <div className={`mt-4 ${tableWrapper}`}>
      <table className={table} aria-label="Your API tokens">
        <thead className={tableHead}>
          <tr>
            <th scope="col" className={tableHeader}>
              Name
            </th>
            <th scope="col" className={`${tableHeader} hidden sm:table-cell`}>
              Made
            </th>
            <th scope="col" className={tableHeader}>
              Expires
            </th>
            <th scope="col" className={`${tableHeader} w-px`}>
              <span className="sr-only">Revoke</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {query.data.map((token) => (
            <TokenRow key={token.id} token={token} now={now} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Personal API tokens, for scripts (such as imports) to act as you: make one, see when each
// expires and was last used, and revoke them.
export function TokensSection() {
  const queryClient = useQueryClient()
  const [made, setMade] = useState<NewToken | null>(null)
  const making = useMutation({
    mutationFn: createToken,
    onSuccess: async (token) => {
      setMade(token)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['api-tokens'] }),
        queryClient.invalidateQueries({ queryKey: ['activity'] }),
      ])
    },
  })

  return (
    <>
      <SectionHeading icon={TokenIcon} className="mt-8">
        API tokens
      </SectionHeading>
      <p className="mt-3 max-w-2xl text-muted">
        A token lets a script, such as an import, act as you, with your permissions. Keep it secret,
        like a password, and revoke it if it might have been seen by anyone else.
      </p>

      <form
        className="mt-4 flex max-w-2xl flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          making.mutate({ name: text(form, 'token-name'), days: Number(text(form, 'token-days')) })
          event.currentTarget.reset()
        }}
      >
        <div className="min-w-48 flex-1">
          <TextField
            label="What it's for"
            name="token-name"
            placeholder="GDC imports"
            required
            maxLength={100}
          />
        </div>
        <SelectField
          label="Lasts"
          name="token-days"
          options={TOKEN_LIFETIMES}
          defaultValue="90"
          required
        />
        <button type="submit" disabled={making.isPending} className={primaryButton}>
          {making.isPending ? 'Making…' : 'Make token'}
        </button>
      </form>
      {making.isError && (
        <p role="alert" className={`mt-4 ${errorBox}`}>
          {making.error.message}
        </p>
      )}
      {made && (
        <NewTokenBox
          token={made}
          onDone={() => {
            setMade(null)
          }}
        />
      )}

      <TokenList />
    </>
  )
}
