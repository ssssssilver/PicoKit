export const LOCAL_ASSET_DB_NAME = "tabnative-local-assets"
export const LOCAL_ASSET_STORE_NAME = "assets"
export const LOCAL_ASSET_MAX_AGE_MS = 2 * 60 * 60 * 1000
export const IMAGE_PIPELINE_BATCH_MAX_ITEMS = 30
export const LOCAL_ASSET_BATCH_MAX_ITEMS = IMAGE_PIPELINE_BATCH_MAX_ITEMS
export const LOCAL_ASSET_BATCH_MAX_BYTES = 250 * 1024 * 1024

export type LocalAssetSource = "background-remover" | "image-editor" | "image-optimizer" | "ai-detector" | "ai-cleaner" | "unknown"

export type LocalAssetRecord = {
  id: string
  blob: Blob
  name: string
  type: string
  size: number
  source: LocalAssetSource
  createdAt: number
}

export type LocalAssetBatchItem = {
  blob: Blob
  name: string
  type: string
  size: number
}

export type LocalAssetBatchRecord = {
  id: string
  kind: "batch"
  items: LocalAssetBatchItem[]
  source: LocalAssetSource
  createdAt: number
}

type StoredLocalAsset = LocalAssetRecord | LocalAssetBatchRecord

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser does not provide local asset storage."))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_ASSET_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(LOCAL_ASSET_STORE_NAME)) {
        const store = database.createObjectStore(LOCAL_ASSET_STORE_NAME, { keyPath: "id" })
        store.createIndex("createdAt", "createdAt")
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Unable to open local asset storage."))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Local asset storage failed."))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error("Local asset transaction was cancelled."))
    transaction.onerror = () => reject(transaction.error ?? new Error("Local asset transaction failed."))
  })
}

export function isLocalAssetExpired(createdAt: number, now = Date.now()) {
  return !Number.isFinite(createdAt) || createdAt <= 0 || now - createdAt > LOCAL_ASSET_MAX_AGE_MS
}

export function localAssetFile(record: LocalAssetRecord) {
  return new File([record.blob], record.name, {
    type: record.type || record.blob.type || "application/octet-stream",
    lastModified: record.createdAt,
  })
}

export function localAssetBatchFiles(record: LocalAssetBatchRecord) {
  return record.items.map((item) => new File([item.blob], item.name, {
    type: item.type || item.blob.type || "application/octet-stream",
    lastModified: record.createdAt,
  }))
}

function makeLocalAssetId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

async function deleteLocalAsset(id: string) {
  if (!id) return
  const database = await openDatabase()
  try {
    const transaction = database.transaction(LOCAL_ASSET_STORE_NAME, "readwrite")
    const completed = transactionDone(transaction)
    transaction.objectStore(LOCAL_ASSET_STORE_NAME).delete(id)
    await completed
  } finally {
    database.close()
  }
}

function scheduleLocalAssetExpiry(id: string, createdAt: number) {
  if (typeof window === "undefined") return
  const delay = Math.max(0, createdAt + LOCAL_ASSET_MAX_AGE_MS - Date.now() + 1_000)
  window.setTimeout(() => {
    void deleteLocalAsset(id).catch(() => undefined)
  }, delay)
}

export async function cleanExpiredLocalAssets(now = Date.now()) {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(LOCAL_ASSET_STORE_NAME, "readwrite")
    const completed = transactionDone(transaction)
    const store = transaction.objectStore(LOCAL_ASSET_STORE_NAME)
    const records = await requestResult(store.getAll() as IDBRequest<StoredLocalAsset[]>)
    for (const record of records) {
      if (isLocalAssetExpired(record.createdAt, now)) store.delete(record.id)
    }
    await completed
  } finally {
    database.close()
  }
}

export async function saveLocalAsset(blob: Blob, name: string, source: LocalAssetSource = "unknown") {
  if (!blob.size) throw new Error("The result is empty and cannot be passed to another tool.")
  const id = makeLocalAssetId()
  const createdAt = Date.now()
  const record: LocalAssetRecord = {
    id,
    blob,
    name: name.trim() || "tabnative-result",
    type: blob.type || "application/octet-stream",
    size: blob.size,
    source,
    createdAt,
  }

  const database = await openDatabase()
  try {
    const transaction = database.transaction(LOCAL_ASSET_STORE_NAME, "readwrite")
    const completed = transactionDone(transaction)
    transaction.objectStore(LOCAL_ASSET_STORE_NAME).put(record)
    await completed
  } finally {
    database.close()
  }

  // Finish cleanup before the caller navigates away. A fire-and-forget
  // IndexedDB request can be orphaned during page unload and keep the next
  // tool waiting on the same database.
  await cleanExpiredLocalAssets(createdAt).catch(() => undefined)
  scheduleLocalAssetExpiry(id, createdAt)
  return id
}

export async function saveLocalAssetBatch(
  inputs: readonly { blob: Blob; name: string }[],
  source: LocalAssetSource = "unknown",
) {
  if (!inputs.length) throw new Error("The queue is empty and cannot be passed to another tool.")
  if (inputs.length > LOCAL_ASSET_BATCH_MAX_ITEMS) throw new Error(`A local handoff can contain up to ${LOCAL_ASSET_BATCH_MAX_ITEMS} images.`)
  const totalBytes = inputs.reduce((sum, item) => sum + item.blob.size, 0)
  if (inputs.some((item) => !item.blob.size)) throw new Error("An empty result cannot be passed to another tool.")
  if (totalBytes > LOCAL_ASSET_BATCH_MAX_BYTES) throw new Error("The local handoff cannot exceed 250 MB. Continue with a smaller batch.")

  const id = makeLocalAssetId()
  const createdAt = Date.now()
  const record: LocalAssetBatchRecord = {
    id,
    kind: "batch",
    items: inputs.map((item, index) => ({
      blob: item.blob,
      name: item.name.trim() || `tabnative-result-${index + 1}`,
      type: item.blob.type || "application/octet-stream",
      size: item.blob.size,
    })),
    source,
    createdAt,
  }

  const database = await openDatabase()
  try {
    const transaction = database.transaction(LOCAL_ASSET_STORE_NAME, "readwrite")
    const completed = transactionDone(transaction)
    transaction.objectStore(LOCAL_ASSET_STORE_NAME).put(record)
    await completed
  } finally {
    database.close()
  }

  await cleanExpiredLocalAssets(createdAt).catch(() => undefined)
  scheduleLocalAssetExpiry(id, createdAt)
  return id
}

export async function loadLocalAsset(id: string, consume = false): Promise<LocalAssetRecord | null> {
  if (!id) return null
  const database = await openDatabase()
  try {
    // Reads use a write transaction so an expired blob is removed immediately
    // instead of being left behind after it has become inaccessible.
    const transaction = database.transaction(LOCAL_ASSET_STORE_NAME, "readwrite")
    const completed = transactionDone(transaction)
    const store = transaction.objectStore(LOCAL_ASSET_STORE_NAME)
    const stored = await requestResult(store.get(id) as IDBRequest<StoredLocalAsset | undefined>)
    const record = stored && !("kind" in stored) ? stored : null
    const expired = Boolean(record && isLocalAssetExpired(record.createdAt))
    if (record && (consume || expired)) store.delete(id)
    await completed
    if (!record || expired) return null
    scheduleLocalAssetExpiry(record.id, record.createdAt)
    return record
  } finally {
    database.close()
  }
}

export async function loadLocalAssetBatch(id: string, consume = false): Promise<LocalAssetBatchRecord | null> {
  if (!id) return null
  const database = await openDatabase()
  try {
    const transaction = database.transaction(LOCAL_ASSET_STORE_NAME, "readwrite")
    const completed = transactionDone(transaction)
    const store = transaction.objectStore(LOCAL_ASSET_STORE_NAME)
    const record = await requestResult(store.get(id) as IDBRequest<StoredLocalAsset | undefined>)
    const batch = record && "kind" in record && record.kind === "batch" ? record : null
    const expired = Boolean(batch && isLocalAssetExpired(batch.createdAt))
    if (batch && (consume || expired)) store.delete(id)
    await completed
    if (!batch || expired) return null
    scheduleLocalAssetExpiry(batch.id, batch.createdAt)
    return batch
  } finally {
    database.close()
  }
}
