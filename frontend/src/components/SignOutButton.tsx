import { useMutation, useQueryClient } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'

import { signOut } from '../api/queries'

// Signing out, in the header (on wider screens) and on the profile page. `className` styles
// the button; `labelClassName` the word "Sign out" (to hide it on phones, say).
export function SignOutButton({
  className,
  labelClassName = '',
}: {
  className: string
  labelClassName?: string
}) {
  const queryClient = useQueryClient()
  const signingOut = useMutation({
    mutationFn: signOut,
    // What can be seen and done may have changed, so fetch everything shown again.
    onSuccess: () => queryClient.invalidateQueries(),
  })

  return (
    <>
      {signingOut.isError && (
        <p role="alert" className="text-sm font-medium text-danger">
          Could not sign out
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          signingOut.mutate()
        }}
        disabled={signingOut.isPending}
        className={className}
      >
        <LogOut aria-hidden="true" className="size-5" />
        <span className={labelClassName}>Sign out</span>
      </button>
    </>
  )
}
