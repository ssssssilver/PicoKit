import { copyFile, mkdir } from "node:fs/promises"

const source = new URL("../node_modules/@contentauth/c2pa-web/dist/resources/c2pa_bg.wasm", import.meta.url)
const destination = new URL("../public/c2pa.wasm", import.meta.url)

await mkdir(new URL("../public/", import.meta.url), { recursive: true })
await copyFile(source, destination)

const pdfWorkerSource = new URL("../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)
const pdfWorkerDestination = new URL("../public/pdf.worker.min.mjs", import.meta.url)
await copyFile(pdfWorkerSource, pdfWorkerDestination)

const dracoSource = new URL("../node_modules/three/examples/jsm/libs/draco/gltf/", import.meta.url)
const dracoDestination = new URL("../public/draco/", import.meta.url)
await mkdir(dracoDestination, { recursive: true })
for (const file of ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"]) {
  await copyFile(new URL(file, dracoSource), new URL(file, dracoDestination))
}
