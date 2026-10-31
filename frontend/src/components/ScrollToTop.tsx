import { useEffect } from 'react'
import { NavigationType, useLocation, useNavigationType } from 'react-router'

// Start each new page at the top, as a browser does when following a link, rather than where
// the last page was scrolled to (so, say, deleting a study doesn't land at the foot of its
// project's page, by the project's own Delete button). Going back or forward (POP) is left to
// the browser. Changing only the query (such as a list's filters) stays where it is.
export function ScrollToTop() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType !== NavigationType.Pop) {
      window.scrollTo(0, 0)
    }
  }, [pathname, navigationType])

  return null
}
