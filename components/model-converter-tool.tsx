"use client"

import { AlertTriangle, Box, CheckCircle2, Download, FileBox, LoaderCircle, Pause, Play, RotateCcw, Upload } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import type { AnimationClip, AnimationMixer, Object3D, PerspectiveCamera, Scene, WebGLRenderer } from "three"
import type { OrbitControls } from "three/addons/controls/OrbitControls.js"

import { useLanguage } from "@/components/language-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatBytes } from "@/components/file-dropzone"
import {
  isModelInputFormat,
  modelExtension,
  modelOutputFormats,
  modelOutputName,
  outputKeepsRichScene,
  selectPrimaryModelFile,
  type ModelInputFormat,
  type ModelOutputFormat,
} from "@/lib/model-converter-core"
import { exportModelData } from "@/lib/model-exporter"

type ModelStats = {
  vertices: number
  triangles: number
  meshes: number
  materials: number
  textures: number
  animations: number
  dimensions: [number, number, number]
}

type LoadedModel = {
  root: Object3D
  animations: AnimationClip[]
  primary: File
  format: ModelInputFormat
  stats: ModelStats
}

type PreviewRuntime = {
  THREE: typeof import("three")
  scene: Scene
  camera: PerspectiveCamera
  renderer: WebGLRenderer
  controls: OrbitControls
  mixer: AnimationMixer | null
  currentRoot: Object3D | null
  setAnimationPlaying: (playing: boolean) => void
}

const MAX_TOTAL_BYTES = 100 * 1024 * 1024
const RELATED_ACCEPT = ".glb,.gltf,.obj,.fbx,.stl,.ply,.mtl,.bin,.png,.jpg,.jpeg,.webp,.bmp,.tga"

export function ModelConverterTool() {
  const { pick, format } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<PreviewRuntime | null>(null)
  const loadedRef = useRef<LoadedModel | null>(null)
  const urlsRef = useRef<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [loaded, setLoaded] = useState<LoadedModel | null>(null)
  const [output, setOutput] = useState<ModelOutputFormat>("glb")
  const [textureSize, setTextureSize] = useState(2048)
  const [loading, setLoading] = useState(false)
  const [converting, setConverting] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("")
  const [activeAnimation, setActiveAnimation] = useState("")
  const [playing, setPlaying] = useState(false)
  const [runtimeReady, setRuntimeReady] = useState(false)

  useEffect(() => {
    const mount = previewRef.current
    if (!mount) return
    let disposed = false
    let frame = 0
    let resizeObserver: ResizeObserver | null = null
    let cleanup = () => {}

    Promise.all([import("three"), import("three/addons/controls/OrbitControls.js")]).then(([THREE, controlsModule]) => {
      if (disposed) return
      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x090b0d)
      const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100000)
      camera.position.set(3, 2.2, 4)
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.05
      mount.appendChild(renderer.domElement)

      const controls = new controlsModule.OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 2.4))
      const key = new THREE.DirectionalLight(0xffffff, 3.2)
      key.position.set(4, 7, 5)
      scene.add(key)
      const fill = new THREE.DirectionalLight(0x67e8f9, 1.2)
      fill.position.set(-5, 2, -3)
      scene.add(fill)
      scene.add(new THREE.GridHelper(20, 20, 0x2b5660, 0x20262a))

      const runtime: PreviewRuntime = {
        THREE,
        scene,
        camera,
        renderer,
        controls,
        mixer: null,
        currentRoot: null,
        setAnimationPlaying(playing) {
          if (this.mixer) this.mixer.timeScale = playing ? 1 : 0
        },
      }
      runtimeRef.current = runtime
      const timer = new THREE.Timer()
      timer.connect(document)
      const resize = () => {
        const width = Math.max(1, mount.clientWidth)
        const height = Math.max(1, mount.clientHeight)
        renderer.setSize(width, height, false)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }
      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(mount)
      resize()
      const animate = () => {
        frame = window.requestAnimationFrame(animate)
        timer.update()
        runtime.mixer?.update(Math.min(timer.getDelta(), 0.05))
        controls.update()
        renderer.render(scene, camera)
      }
      animate()
      setRuntimeReady(true)
      cleanup = () => {
        window.cancelAnimationFrame(frame)
        resizeObserver?.disconnect()
        controls.dispose()
        timer.dispose()
        renderer.dispose()
        renderer.domElement.remove()
        runtimeRef.current = null
      }
    }).catch(() => setError("当前浏览器无法启动 3D 预览 / This browser could not start the 3D preview."))

    return () => {
      disposed = true
      cleanup()
    }
  }, [])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime || !loaded) return
    if (runtime.currentRoot) runtime.scene.remove(runtime.currentRoot)
    runtime.mixer?.stopAllAction()
    runtime.currentRoot = loaded.root
    runtime.scene.add(loaded.root)
    fitCamera(runtime, loaded.root)

    let cancelled = false
    import("three").then((THREE) => {
      if (cancelled || !runtimeRef.current || runtime.currentRoot !== loaded.root) return
      runtime.mixer = loaded.animations.length ? new THREE.AnimationMixer(loaded.root) : null
      if (runtime.mixer && loaded.animations[0]) {
        runtime.mixer.clipAction(loaded.animations[0]).play()
        setActiveAnimation(loaded.animations[0].name || "animation-1")
        setPlaying(true)
      } else {
        setActiveAnimation("")
        setPlaying(false)
      }
    })
    return () => { cancelled = true }
  }, [loaded, runtimeReady])

  useEffect(() => {
    loadedRef.current = loaded
  }, [loaded])

  useEffect(() => () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    disposeObject(loadedRef.current?.root ?? null)
  }, [])

  async function chooseFiles(nextFiles: File[]) {
    if (!nextFiles.length) return
    const total = nextFiles.reduce((sum, file) => sum + file.size, 0)
    const primary = selectPrimaryModelFile(nextFiles)
    if (!primary) {
      setError(pick("没有找到可读取的 3D 主文件。请选择 GLB、glTF、OBJ、FBX、STL 或 PLY。", "No supported 3D model was found. Choose GLB, glTF, OBJ, FBX, STL, or PLY."))
      return
    }
    if (total > MAX_TOTAL_BYTES) {
      setError(pick("所选文件总大小不能超过 100MB。", "The selected files cannot exceed 100MB in total."))
      return
    }
    setError("")
    setStatus(pick("正在本地解析模型与关联资源", "Parsing the model and related assets locally"))
    setLoading(true)
    setFiles(nextFiles)
    if (runtimeRef.current?.currentRoot) {
      runtimeRef.current.scene.remove(runtimeRef.current.currentRoot)
      runtimeRef.current.currentRoot = null
    }
    runtimeRef.current?.mixer?.stopAllAction()
    if (loaded) disposeObject(loaded.root)
    setLoaded(null)
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    urlsRef.current = []
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 30))
      const result = await loadModelBundle(nextFiles, primary, urlsRef.current)
      setLoaded(result)
      setStatus(pick("模型已载入，可预览并转换", "Model loaded and ready to preview or convert"))
    } catch (reason) {
      setStatus("")
      setError(readableLoadError(reason, pick))
    } finally {
      setLoading(false)
    }
  }

  async function convert() {
    if (!loaded) return
    setConverting(true)
    setError("")
    setStatus(format("正在生成 {format} 文件", "Creating the {format} file", { format: output.toUpperCase() }))
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 20))
      const blob = await exportModelData(loaded.root, loaded.animations, output, textureSize)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = modelOutputName(loaded.primary.name, output)
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus(format("{format} 已在本地生成", "{format} created locally", { format: output.toUpperCase() }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : pick("模型转换未能完成。", "Model conversion could not be completed."))
    } finally {
      setConverting(false)
    }
  }

  function reset() {
    disposeObject(loaded?.root ?? null)
    if (runtimeRef.current?.currentRoot) runtimeRef.current.scene.remove(runtimeRef.current.currentRoot)
    if (runtimeRef.current) runtimeRef.current.currentRoot = null
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    urlsRef.current = []
    setFiles([])
    setLoaded(null)
    setError("")
    setStatus("")
    if (inputRef.current) inputRef.current.value = ""
  }

  function selectAnimation(name: string) {
    if (!loaded || !runtimeRef.current?.mixer) return
    runtimeRef.current.mixer.stopAllAction()
    const index = loaded.animations.findIndex((clip, clipIndex) => (clip.name || `animation-${clipIndex + 1}`) === name)
    if (index < 0) return
    runtimeRef.current.mixer.clipAction(loaded.animations[index]).reset().play()
    setActiveAnimation(name)
    setPlaying(true)
  }

  function toggleAnimation() {
    const runtime = runtimeRef.current
    if (!runtime?.mixer) return
    const next = !playing
    runtime.setAnimationPlaying(next)
    setPlaying(next)
  }

  return <div className="space-y-6">
    <Card className="border-white/10 bg-[#0d0d0d] shadow-none">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base text-zinc-100"><FileBox className="size-4 text-cyan-300" />{pick("选择 3D 模型文件", "Choose 3D model files")}</CardTitle><p className="mt-1 text-sm leading-6 text-zinc-500">{pick("可同时选择主模型、MTL、BIN 和贴图文件。文件只在当前浏览器中解析。", "Select the main model together with MTL, BIN, and texture files. Everything is parsed in this browser.")}</p></CardHeader>
      <CardContent className="space-y-5">
        <button type="button" disabled={loading || converting} onClick={() => inputRef.current?.click()} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void chooseFiles(Array.from(event.dataTransfer.files)) }} className={`flex min-h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center transition ${dragging ? "border-cyan-300 bg-cyan-300/[.07]" : "border-white/15 bg-black/25 hover:border-cyan-300/40 hover:bg-white/[.025]"}`}>
          {loading ? <LoaderCircle className="size-8 animate-spin text-cyan-300" /> : <Upload className="size-8 text-cyan-300" />}
          <span className="mt-4 text-sm font-semibold text-zinc-100">{loading ? pick("正在解析模型", "Parsing model") : pick("拖入模型文件，或点击选择", "Drop model files, or click to choose")}</span>
          <span className="mt-2 font-mono text-xs text-zinc-500">GLB · glTF · OBJ · FBX · STL · PLY · {pick("总计最大 100MB", "100MB total")}</span>
        </button>
        <input ref={inputRef} type="file" multiple accept={RELATED_ACCEPT} className="sr-only" onChange={(event) => void chooseFiles(Array.from(event.target.files ?? []))} />

        {files.length ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.02] p-4"><div><p className="text-sm font-medium text-zinc-100">{loaded?.primary.name ?? selectPrimaryModelFile(files)?.name}</p><p className="mt-1 text-xs text-zinc-500">{files.length} {pick("个关联文件", "related files")} · {formatBytes(files.reduce((sum, file) => sum + file.size, 0))}</p></div><Button variant="outline" onClick={reset} disabled={loading || converting}><RotateCcw />{pick("重新选择", "Choose again")}</Button></div> : null}
        {status ? <p className="flex items-center gap-2 text-sm text-zinc-400">{loading || converting ? <LoaderCircle className="size-4 animate-spin text-cyan-300" /> : <CheckCircle2 className="size-4 text-emerald-400" />}{status}</p> : null}
        {error ? <Alert variant="destructive"><AlertTriangle /><AlertTitle>{pick("无法处理模型", "Model processing unavailable")}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
      </CardContent>
    </Card>

    <Card className="overflow-hidden border-white/10 bg-[#0d0d0d] shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-white/10"><div><CardTitle className="flex items-center gap-2 text-base text-zinc-100"><Box className="size-4 text-cyan-300" />{pick("交互式模型预览", "Interactive model preview")}</CardTitle><p className="mt-1 text-xs text-zinc-500">{pick("拖动旋转 · 滚轮缩放 · 右键平移", "Drag to rotate · Scroll to zoom · Right-drag to pan")}</p></div>{loaded ? <Badge variant="outline" className="border-cyan-300/20 text-cyan-200">{loaded.format.toUpperCase()}</Badge> : null}</CardHeader>
      <CardContent className="p-0"><div ref={previewRef} className="h-[420px] w-full bg-[#090b0d] sm:h-[520px]" aria-label={pick("3D 模型预览画布", "3D model preview canvas")} /></CardContent>
      {loaded?.animations.length ? <div className="flex flex-wrap items-center gap-3 border-t border-white/10 p-4"><select value={activeAnimation} onChange={(event) => selectAnimation(event.target.value)} className="h-10 min-w-48 rounded-lg border border-white/15 bg-black px-3 text-sm text-zinc-200 outline-none focus:border-cyan-300/50">{loaded.animations.map((clip, index) => { const name = clip.name || `animation-${index + 1}`; return <option key={name} value={name}>{name}</option> })}</select><Button variant="outline" onClick={toggleAnimation}>{playing ? <Pause /> : <Play />}{playing ? pick("暂停动画", "Pause animation") : pick("播放动画", "Play animation")}</Button></div> : null}
    </Card>

    {loaded ? <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card className="border-white/10 bg-[#0d0d0d] shadow-none"><CardHeader><CardTitle className="text-base text-zinc-100">{pick("模型信息", "Model details")}</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Stat label={pick("网格", "Meshes")} value={loaded.stats.meshes.toLocaleString()} /><Stat label={pick("顶点", "Vertices")} value={loaded.stats.vertices.toLocaleString()} /><Stat label={pick("三角面", "Triangles")} value={loaded.stats.triangles.toLocaleString()} /><Stat label={pick("材质", "Materials")} value={loaded.stats.materials.toLocaleString()} /><Stat label={pick("贴图", "Textures")} value={loaded.stats.textures.toLocaleString()} /><Stat label={pick("动画", "Animations")} value={loaded.stats.animations.toLocaleString()} /><div className="col-span-2 sm:col-span-3"><Stat label={pick("模型尺寸", "Dimensions")} value={loaded.stats.dimensions.map((value) => formatDimension(value)).join(" × ")} /></div></CardContent></Card>

      <Card className="border-white/10 bg-[#0d0d0d] shadow-none"><CardHeader><CardTitle className="text-base text-zinc-100">{pick("转换与下载", "Convert and download")}</CardTitle><p className="mt-1 text-sm leading-6 text-zinc-500">{pick("GLB 可保留场景、材质、贴图和动画。OBJ、STL、PLY 主要用于交换几何数据。", "GLB can preserve scenes, materials, textures, and animation. OBJ, STL, and PLY are primarily geometry exchange formats.")}</p></CardHeader><CardContent className="space-y-4"><label className="block"><span className="text-xs font-medium text-zinc-400">{pick("输出格式", "Output format")}</span><select value={output} onChange={(event) => setOutput(event.target.value as ModelOutputFormat)} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-black px-3 text-sm text-zinc-100 outline-none focus:border-cyan-300/50">{modelOutputFormats.map((format) => <option key={format} value={format}>{format.toUpperCase()}{format === "glb" ? pick(" · 推荐", " · Recommended") : ""}</option>)}</select></label>{outputKeepsRichScene(output) ? <label className="block"><span className="text-xs font-medium text-zinc-400">{pick("最大贴图尺寸", "Maximum texture size")}</span><select value={textureSize} onChange={(event) => setTextureSize(Number(event.target.value))} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-black px-3 text-sm text-zinc-100 outline-none focus:border-cyan-300/50"><option value={1024}>1024 px</option><option value={2048}>2048 px</option><option value={4096}>4096 px</option></select></label> : <Alert className="border-amber-400/20 bg-amber-400/[.04] text-zinc-300"><AlertTriangle className="text-amber-300" /><AlertTitle>{pick("该格式以几何交换为主", "Geometry-focused output")}</AlertTitle><AlertDescription>{pick("材质、贴图、灯光、相机、骨骼或动画可能不会保留。原始模型不会被修改。", "Materials, textures, lights, cameras, rigs, or animation may not be preserved. The source model is never changed.")}</AlertDescription></Alert>}<Button size="lg" className="w-full bg-cyan-300 text-black hover:bg-cyan-200" onClick={convert} disabled={converting}><Download />{converting ? pick("正在本地转换", "Converting locally") : format("转换并下载 {format}", "Convert and download {format}", { format: output.toUpperCase() })}</Button></CardContent></Card>
    </div> : null}
  </div>
}

async function loadModelBundle(files: File[], primary: File, urls: string[]): Promise<LoadedModel> {
  const THREE = await import("three")
  const manager = new THREE.LoadingManager()
  const urlByName = new Map<string, string>()
  for (const file of files) {
    const url = URL.createObjectURL(file)
    urls.push(url)
    urlByName.set(file.name.toLowerCase(), url)
    urlByName.set(file.webkitRelativePath.toLowerCase(), url)
  }
  manager.setURLModifier((requested) => {
    const cleaned = decodeURIComponent(requested).split(/[?#]/)[0].replace(/^\.\//, "").toLowerCase()
    const base = cleaned.split(/[\\/]/).pop() ?? cleaned
    return urlByName.get(cleaned) ?? urlByName.get(base) ?? requested
  })
  const primaryUrl = urlByName.get(primary.name.toLowerCase())
  if (!primaryUrl) throw new Error("primary-model-url-missing")
  const format = modelExtension(primary.name)
  if (!isModelInputFormat(format)) throw new Error("unsupported-model-format")

  let root: Object3D
  let animations: AnimationClip[] = []
  if (format === "glb" || format === "gltf") {
    const [{ GLTFLoader }, { DRACOLoader }, meshopt] = await Promise.all([
      import("three/addons/loaders/GLTFLoader.js"),
      import("three/addons/loaders/DRACOLoader.js"),
      import("three/addons/libs/meshopt_decoder.module.js"),
    ])
    const draco = new DRACOLoader(manager).setDecoderPath("/draco/")
    const loader = new GLTFLoader(manager).setDRACOLoader(draco).setMeshoptDecoder(meshopt.MeshoptDecoder)
    const result = await loader.loadAsync(primaryUrl)
    draco.dispose()
    root = result.scene
    animations = result.animations
  } else if (format === "fbx") {
    const { FBXLoader } = await import("three/addons/loaders/FBXLoader.js")
    root = await new FBXLoader(manager).loadAsync(primaryUrl)
    animations = root.animations ?? []
  } else if (format === "obj") {
    const [{ OBJLoader }, { MTLLoader }] = await Promise.all([import("three/addons/loaders/OBJLoader.js"), import("three/addons/loaders/MTLLoader.js")])
    const loader = new OBJLoader(manager)
    const mtl = files.find((file) => modelExtension(file.name) === "mtl")
    if (mtl) {
      const mtlUrl = urlByName.get(mtl.name.toLowerCase())
      if (mtlUrl) {
        const materials = await new MTLLoader(manager).loadAsync(mtlUrl)
        materials.preload()
        loader.setMaterials(materials)
      }
    }
    root = await loader.loadAsync(primaryUrl)
  } else if (format === "stl") {
    const { STLLoader } = await import("three/addons/loaders/STLLoader.js")
    const geometry = await new STLLoader(manager).loadAsync(primaryUrl)
    geometry.computeVertexNormals()
    root = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xb7c7cc, roughness: 0.58, metalness: 0.08 }))
  } else {
    const { PLYLoader } = await import("three/addons/loaders/PLYLoader.js")
    const geometry = await new PLYLoader(manager).loadAsync(primaryUrl)
    geometry.computeVertexNormals()
    const hasColor = Boolean(geometry.getAttribute("color"))
    root = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: hasColor ? 0xffffff : 0xb7c7cc, vertexColors: hasColor, roughness: 0.58, metalness: 0.08 }))
  }
  root.name ||= primary.name.replace(/\.[^.]+$/, "")
  root.updateMatrixWorld(true)
  return { root, animations, primary, format, stats: collectStats(root, animations, THREE) }
}

function collectStats(root: Object3D, animations: AnimationClip[], THREE: typeof import("three")): ModelStats {
  const materials = new Set<unknown>()
  const textures = new Set<unknown>()
  let meshes = 0
  let vertices = 0
  let triangles = 0
  root.traverse((object) => {
    const mesh = object as Object3D & { isMesh?: boolean; geometry?: { getAttribute: (name: string) => { count: number } | undefined; index?: { count: number } | null }; material?: unknown | unknown[] }
    if (!mesh.isMesh || !mesh.geometry) return
    meshes += 1
    const positionCount = mesh.geometry.getAttribute("position")?.count ?? 0
    vertices += positionCount
    triangles += Math.floor((mesh.geometry.index?.count ?? positionCount) / 3)
    const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
    for (const material of list) {
      materials.add(material)
      for (const value of Object.values(material as Record<string, unknown>)) if (value && typeof value === "object" && "isTexture" in value) textures.add(value)
    }
  })
  const dimensions: [number, number, number] = [0, 0, 0]
  const box = new THREE.Box3().setFromObject(root)
  if (!box.isEmpty()) {
    dimensions[0] = box.max.x - box.min.x
    dimensions[1] = box.max.y - box.min.y
    dimensions[2] = box.max.z - box.min.z
  }
  return { meshes, vertices, triangles, materials: materials.size, textures: textures.size, animations: animations.length, dimensions }
}

function fitCamera(runtime: PreviewRuntime, root: Object3D) {
  const THREE = runtime.THREE
  const box = new THREE.Box3().setFromObject(root)
  if (box.isEmpty()) return
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const radius = Math.max(size.x, size.y, size.z, 0.01)
  const distance = radius / (2 * Math.tan((runtime.camera.fov * Math.PI) / 360)) * 1.8
  runtime.camera.near = Math.max(distance / 1000, 0.001)
  runtime.camera.far = Math.max(distance * 100, 1000)
  runtime.camera.position.copy(center).add(new THREE.Vector3(distance * 0.8, distance * 0.55, distance))
  runtime.camera.updateProjectionMatrix()
  runtime.controls.target.copy(center)
  runtime.controls.update()
}

function disposeObject(root: Object3D | null) {
  if (!root) return
  root.traverse((object) => {
    const mesh = object as Object3D & { geometry?: { dispose?: () => void }; material?: unknown | unknown[] }
    mesh.geometry?.dispose?.()
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
    for (const material of materials) {
      for (const value of Object.values(material as Record<string, unknown>)) if (value && typeof value === "object" && "isTexture" in value && "dispose" in value) (value as { dispose: () => void }).dispose()
      if (material && typeof material === "object" && "dispose" in material) (material as { dispose: () => void }).dispose()
    }
  })
}

export function readableLoadError(reason: unknown, localizer: "zh-CN" | "en" | ((zh: string, en: string) => string)) {
  const message = reason instanceof Error ? reason.message : ""
  const pick = typeof localizer === "function" ? localizer : (zh: string, en: string) => localizer === "zh-CN" ? zh : en
  if (/dynamically imported module|importing a module script failed|module script/i.test(message)) return pick("本地 3D 引擎未能完成加载，请刷新页面后重试。", "The local 3D engine did not finish loading. Refresh the page and try again.")
  if (/failed to load buffer|could not load.*(?:texture|\.bin|\.mtl)|404.*(?:texture|\.bin|\.mtl)/i.test(message)) return pick("关联的 BIN、MTL 或贴图文件缺失或无法读取，请同时选择主模型与所有关联文件。", "A related BIN, MTL, or texture file is missing or could not be read. Select the model and all related files together.")
  if (/failed to fetch|networkerror|load failed/i.test(message)) return pick("浏览器未能读取所选本地模型，请重新选择文件，或刷新页面后重试。", "The browser could not read the selected local model. Re-select the file or refresh the page and try again.")
  if (/memory|allocation|out of/i.test(message)) return pick("模型超出当前浏览器可用内存，请使用更小的模型或更低分辨率贴图。", "The model exceeded available browser memory. Try a smaller model or lower-resolution textures.")
  return pick("无法解析该模型，请确认文件格式与内容完整。", "The model could not be parsed. Confirm that its format and file contents are valid.")
}

function formatDimension(value: number) {
  if (!Number.isFinite(value)) return "—"
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (Math.abs(value) >= 10) return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 })
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.025] p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 font-mono text-sm font-semibold text-zinc-100">{value}</p></div>
}
