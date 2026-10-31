// What's needed to say how many of an assay's files hold the data of all its samples.
export interface AssayFiles {
  assay_id: string
  assay_name: string
  assay_wide_files: number
}

// The assays with files that have no samples of their own, each once, in the order given.
export function assaysWithWideFiles<T extends AssayFiles>(assays: T[]) {
  const seen = new Set<string>()
  return assays.filter((assay) => {
    if (assay.assay_wide_files === 0 || seen.has(assay.assay_id)) {
      return false
    }
    seen.add(assay.assay_id)
    return true
  })
}
