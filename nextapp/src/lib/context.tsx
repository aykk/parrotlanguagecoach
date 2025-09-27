"use client"

import type React from "react"
import { createContext, useContext } from "react"

interface V0ContextType {
  isV0: boolean
}

const V0Context = createContext<V0ContextType | null>(null)

export function V0Provider({
  children,
  isV0,
}: {
  children: React.ReactNode
  isV0: boolean
}) {
  return <V0Context.Provider value={{ isV0 }}>{children}</V0Context.Provider>
}

export function useIsV0(): boolean {
  const context = useContext(V0Context)
  if (context === null) {
    throw new Error("useIsV0 must be used within a V0Provider")
  }
  return context.isV0
}
