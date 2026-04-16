export function slugify(slugee: string) {
  return slugee
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // replace non-alphanumeric chars with "-"
    .replace(/^-+|-+$/g, ""); // replace "-" at the start/emd of the string with ""
}
