import type { PdfWorkspacePage } from "@/lib/pdf-organizer"
import type { PdfTargetOrientation, PdfTargetPageSize } from "@/lib/pdf-conversion"
import type { PdfCompressionMode } from "@/lib/pdf-compression"

const PDF_DRAFT_DB = "tabnative-pdf-workspace"
const PDF_DRAFT_STORE = "drafts"
const PDF_DRAFT_ID = "current"
const PDF_DRAFT_META_ID = "current-meta"
export const PDF_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type PdfDraftSource = {
  id: string
  blob: Blob
  name: string
  type: string
  lastModified: number
  pages: number
  color: string
}

export type PdfDraftSettings = {
  outputName: string
  metadataMode: "clear" | "custom"
  documentTitle: string
  documentAuthor: string
  documentSubject: string
  documentKeywords: string
  addPageNumbers: boolean
  pageNumberStart: number
  addWatermark: boolean
  watermarkText: string
  watermarkOpacity: number
  normalizePages: boolean
  cropMargin: number
  targetPageSize: PdfTargetPageSize
  targetOrientation: PdfTargetOrientation
  targetMargin: number
  splitSpec: string
  compressionMode: PdfCompressionMode
}

export type PdfWorkspaceDraft = {
  id: typeof PDF_DRAFT_ID
  version: 1
  savedAt: number
  sources: PdfDraftSource[]
  pagePlan: PdfWorkspacePage[]
  settings: PdfDraftSettings
}

type PdfDraftMeta = { id: typeof PDF_DRAFT_META_ID; savedAt: number; sources: number; pages: number; bytes: number }

export function isPdfDraftExpired(savedAt: number, now = Date.now()) {
  return !Number.isFinite(savedAt) || savedAt <= 0 || now - savedAt > PDF_DRAFT_MAX_AGE_MS
}

function openDatabase() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is unavailable"))
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(PDF_DRAFT_DB, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PDF_DRAFT_STORE)) request.result.createObjectStore(PDF_DRAFT_STORE, { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Unable to open PDF draft storage"))
  })
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("PDF draft storage failed"))
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error("PDF draft transaction was cancelled"))
    transaction.onerror = () => reject(transaction.error ?? new Error("PDF draft transaction failed"))
  })
}

export async function savePdfWorkspaceDraft(input: Omit<PdfWorkspaceDraft, "id" | "version" | "savedAt">) {
  const savedAt = Date.now()
  const draft: PdfWorkspaceDraft = { ...input, id: PDF_DRAFT_ID, version: 1, savedAt }
  const meta: PdfDraftMeta = {
    id: PDF_DRAFT_META_ID,
    savedAt,
    sources: draft.sources.length,
    pages: draft.pagePlan.length,
    bytes: draft.sources.reduce((sum, source) => sum + source.blob.size, 0),
  }
  const database = await openDatabase()
  try {
    const transaction = database.transaction(PDF_DRAFT_STORE, "readwrite")
    const store = transaction.objectStore(PDF_DRAFT_STORE)
    store.put(draft)
    store.put(meta)
    await transactionDone(transaction)
  } finally {
    database.close()
  }
  return meta
}

export async function getPdfWorkspaceDraftMeta() {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(PDF_DRAFT_STORE, "readwrite")
    const store = transaction.objectStore(PDF_DRAFT_STORE)
    const meta = await requestResult(store.get(PDF_DRAFT_META_ID) as IDBRequest<PdfDraftMeta | undefined>)
    if (meta && isPdfDraftExpired(meta.savedAt)) {
      store.delete(PDF_DRAFT_ID)
      store.delete(PDF_DRAFT_META_ID)
    }
    await transactionDone(transaction)
    if (!meta || isPdfDraftExpired(meta.savedAt)) return null
    return meta
  } finally {
    database.close()
  }
}

export async function loadPdfWorkspaceDraft() {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(PDF_DRAFT_STORE, "readwrite")
    const store = transaction.objectStore(PDF_DRAFT_STORE)
    const draft = await requestResult(store.get(PDF_DRAFT_ID) as IDBRequest<PdfWorkspaceDraft | undefined>)
    if (draft && (draft.version !== 1 || isPdfDraftExpired(draft.savedAt))) {
      store.delete(PDF_DRAFT_ID)
      store.delete(PDF_DRAFT_META_ID)
    }
    await transactionDone(transaction)
    if (!draft || draft.version !== 1 || isPdfDraftExpired(draft.savedAt)) return null
    return draft
  } finally {
    database.close()
  }
}

export async function clearPdfWorkspaceDraft() {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(PDF_DRAFT_STORE, "readwrite")
    const store = transaction.objectStore(PDF_DRAFT_STORE)
    store.delete(PDF_DRAFT_ID)
    store.delete(PDF_DRAFT_META_ID)
    await transactionDone(transaction)
  } finally {
    database.close()
  }
}
