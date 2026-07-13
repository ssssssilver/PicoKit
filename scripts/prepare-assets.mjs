import { copyFile, mkdir } from "node:fs/promises"

const source = new URL("../node_modules/@contentauth/c2pa-web/dist/resources/c2pa_bg.wasm", import.meta.url)
const destination = new URL("../public/c2pa.wasm", import.meta.url)

await mkdir(new URL("../public/", import.meta.url), { recursive: true })
await copyFile(source, destination)
