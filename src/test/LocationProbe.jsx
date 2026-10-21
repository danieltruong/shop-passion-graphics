import { useLocation } from 'react-router'

/** Renders the current URL, so tests can assert where a navigation went. */
export default function LocationProbe() {
  const { pathname, search, hash } = useLocation()
  return <output data-testid="location">{`${pathname}${search}${hash}`}</output>
}
