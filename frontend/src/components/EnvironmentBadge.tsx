// Which site this is, in gold beside the logo, when it isn't the real one: "Staging" or
// "Local". Production builds have none (see vite.config.ts).
export function EnvironmentBadge() {
  const environment = import.meta.env.VITE_APP_ENVIRONMENT
  if (!environment) {
    return null
  }
  return (
    <span className="rounded-md bg-gold px-2 py-0.5 text-xs font-semibold tracking-wide text-ink uppercase">
      {environment}
    </span>
  )
}
