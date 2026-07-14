const HUGGING_FACE_ORIGIN = "https://huggingface.co"
const MODEL_PROXY_PREFIX = "/_models/"

const ALLOWED_MODELS = ["onnx-community/tmr-ai-text-detector-ONNX"] as const

function allowedModelPath(pathname: string) {
  return ALLOWED_MODELS.some((model) => pathname.startsWith(`/${model}/resolve/`))
}

export function toModelProxyUrl(remoteUrl: string, appOrigin: string) {
  const source = new URL(remoteUrl)
  if (source.origin !== HUGGING_FACE_ORIGIN || !allowedModelPath(source.pathname)) return null
  return new URL(`${MODEL_PROXY_PREFIX}${source.pathname.slice(1)}${source.search}`, appOrigin).toString()
}

export function resolveModelProxyTarget(requestUrl: string) {
  const request = new URL(requestUrl)
  if (!request.pathname.startsWith(MODEL_PROXY_PREFIX)) return null
  const modelPath = `/${request.pathname.slice(MODEL_PROXY_PREFIX.length)}`
  if (!allowedModelPath(modelPath)) return null
  return `${HUGGING_FACE_ORIGIN}${modelPath}${request.search}`
}

export function isModelProxyRequest(requestUrl: string) {
  return new URL(requestUrl).pathname.startsWith(MODEL_PROXY_PREFIX)
}
