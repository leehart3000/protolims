import { SquareArrowRight } from 'lucide-react'

import { rowIcon, tableCell } from '../styles'

// The last cell of a clickable table row. It's hidden from screen readers, because the
// row's link already says where it goes.
export function RowArrow() {
  return (
    <td className={`${tableCell} ${rowIcon}`} aria-hidden="true">
      <SquareArrowRight className="size-5" />
    </td>
  )
}
