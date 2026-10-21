import { useEffect } from 'react'
import { SITE_NAME } from '../content/site.js'

/** Sets document.title to "title | site name", or the site name alone; null leaves it as is. */
export default function usePageTitle(title) {
  useEffect(() => {
    if (title === null) return
    document.title = title ? `${title} | ${SITE_NAME}` : SITE_NAME
  }, [title])
}
