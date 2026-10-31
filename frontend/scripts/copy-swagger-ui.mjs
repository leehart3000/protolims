// Copies Swagger UI's script and styles, from the swagger-ui-dist package (its exact version
// pinned in package.json, and checked against pnpm-lock.yaml when installed), into
// public/swagger-ui/. So the API's documentation page (/api/docs) loads them from the site
// itself rather than from a CDN, where a changed file would run on the site's own address.
// Runs before `vite` and `vite build`; the copies aren't kept in git.
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontend = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(frontend, 'node_modules', 'swagger-ui-dist')
const target = join(frontend, 'public', 'swagger-ui')

mkdirSync(target, { recursive: true })
for (const file of ['swagger-ui-bundle.js', 'swagger-ui.css']) {
  copyFileSync(join(source, file), join(target, file))
}
