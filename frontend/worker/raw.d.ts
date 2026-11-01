// Files imported as text (Vite's "?raw"), as the tests do with public/_headers.
declare module '*?raw' {
  const content: string
  export default content
}
