"use client"

import Link from "next/link"
import { ArrowRight, BookOpenText } from "lucide-react"
import { usePathname } from "next/navigation"

import { Localized } from "@/components/localized"

export function ToolGuideLink() {
  const pathname = usePathname()
  const toolPath = pathname.replace(/\/+$/, "")
  const slug = toolPath.split("/").filter(Boolean).at(-1)

  if (!slug) return null

  return (
    <Link
      href={`/blog/${slug}`}
      className="group inline-flex min-h-11 items-center gap-3 rounded-lg border border-cyan-300/25 bg-cyan-300/[.055] px-4 py-2.5 text-left text-cyan-200 transition hover:border-cyan-300/45 hover:bg-cyan-300/[.1] hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40"
    >
      <BookOpenText className="size-[18px] shrink-0 text-cyan-300" aria-hidden="true" />
      <span className="text-sm font-semibold"><Localized zh="查看完整使用教程" en="Read the complete tool guide" /></span>
      <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}
