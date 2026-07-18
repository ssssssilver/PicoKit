import { copyFile, cp, mkdir, rm } from "node:fs/promises"

const source = new URL("../node_modules/@contentauth/c2pa-web/dist/resources/c2pa_bg.wasm", import.meta.url)
const destination = new URL("../public/c2pa.wasm", import.meta.url)

await mkdir(new URL("../public/", import.meta.url), { recursive: true })
await copyFile(source, destination)

const pdfWorkerSource = new URL("../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)
const pdfWorkerDestination = new URL("../public/pdf.worker.min.mjs", import.meta.url)
await copyFile(pdfWorkerSource, pdfWorkerDestination)

// PDF.js uses separate decoders for JPEG 2000, JBIG2, and ICC color spaces.
// Keep their original filenames because the worker resolves them relative to
// the wasmUrl passed to getDocument().
const pdfWasmSource = new URL("../node_modules/pdfjs-dist/wasm/", import.meta.url)
const pdfWasmDestination = new URL("../public/pdfjs/wasm/", import.meta.url)
await mkdir(pdfWasmDestination, { recursive: true })
for (const obsoleteFile of ["jbig2_nowasm_fallback.js", "openjpeg_nowasm_fallback.js"]) {
  await rm(new URL(obsoleteFile, pdfWasmDestination), { force: true })
}
for (const file of [
  "jbig2.wasm",
  "openjpeg.wasm",
  "qcms_bg.wasm",
]) {
  await copyFile(new URL(file, pdfWasmSource), new URL(file, pdfWasmDestination))
}

// CID-keyed PDFs such as many Chinese invoices depend on Adobe CMaps to map
// character codes to glyphs. Standard-font files also keep non-embedded fonts
// readable instead of falling back to placeholder glyphs.
for (const directory of ["cmaps", "standard_fonts"]) {
  const sourceDirectory = new URL(`../node_modules/pdfjs-dist/${directory}/`, import.meta.url)
  const destinationDirectory = new URL(`../public/pdfjs/${directory}/`, import.meta.url)
  await rm(destinationDirectory, { recursive: true, force: true })
  await cp(sourceDirectory, destinationDirectory, { recursive: true })
}

const dracoSource = new URL("../node_modules/three/examples/jsm/libs/draco/gltf/", import.meta.url)
const dracoDestination = new URL("../public/draco/", import.meta.url)
await mkdir(dracoDestination, { recursive: true })
for (const file of ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"]) {
  await copyFile(new URL(file, dracoSource), new URL(file, dracoDestination))
}
