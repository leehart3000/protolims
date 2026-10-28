import { SquareMenu } from 'lucide-react'

import { rowButton, tableCell } from '../styles'

// The last cell of a clickable table row: a "Details" button. The whole row is the link, so
// the button only shows where to click. It's hidden from screen readers, because the row's
// link already says where it goes. On phones, only the icon is shown, to save space.
export function RowArrow() {
  return (
    <td className={tableCell} aria-hidden="true">
      <span className={rowButton}>
        <SquareMenu className="size-4 shrink-0" />
        <span className="hidden sm:inline">Details</span>
      </span>
    </td>
  )
}
