"use client"

import { createContext, useContext, useMemo, useRef, type ReactNode } from "react"

type WorkflowMemory = {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T): void
  delete(key: string): void
}

const ImageWorkflowMemoryContext = createContext<WorkflowMemory | null>(null)

export function ImageWorkflowMemoryProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef(new Map<string, unknown>())
  const memory = useMemo<WorkflowMemory>(() => ({
    get: <T,>(key: string) => storeRef.current.get(key) as T | undefined,
    set: <T,>(key: string, value: T) => { storeRef.current.set(key, value) },
    delete: (key: string) => { storeRef.current.delete(key) },
  }), [])

  return <ImageWorkflowMemoryContext.Provider value={memory}>{children}</ImageWorkflowMemoryContext.Provider>
}

export function useImageWorkflowMemory() {
  const memory = useContext(ImageWorkflowMemoryContext)
  if (!memory) throw new Error("Image workflow memory is unavailable")
  return memory
}
