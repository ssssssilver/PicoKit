import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { ToolGuideArticle } from "@/components/tool-guide-article"
import { getToolGuide, toolGuides, toolGuidesUpdatedAt } from "@/lib/tool-guides"

type PageProps = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return toolGuides.map((guide) => ({ slug: guide.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const guide = getToolGuide(slug)
  if (!guide) return { title: "Guide not found" }
  return {
    title: `How to Use ${guide.titleEn}`,
    description: `${guide.descriptionEn} Follow preparation, step-by-step usage, verification, and troubleshooting guidance.`,
    keywords: [guide.titleEn, `${guide.titleEn} guide`, `how to use ${guide.titleEn}`, guide.categoryTitleEn],
    openGraph: { title: `How to Use ${guide.titleEn} | TabNative`, description: guide.descriptionEn, type: "article", modifiedTime: toolGuidesUpdatedAt },
  }
}

export default async function ToolGuidePage({ params }: PageProps) {
  const { slug } = await params
  const guide = getToolGuide(slug)
  if (!guide) notFound()

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to use ${guide.titleEn}`,
    description: guide.descriptionEn,
    dateModified: toolGuidesUpdatedAt,
    totalTime: `PT${guide.readMinutes}M`,
    tool: [{ "@type": "HowToTool", name: guide.titleEn }],
    step: guide.steps.map((item, index) => ({ "@type": "HowToStep", position: index + 1, name: item.titleEn, text: item.en, url: `/blog/${guide.slug}#steps` })),
  }

  return (
    <div className="min-h-screen bg-[#080808] text-zinc-100">
      <SiteHeader />
      <ToolGuideArticle slug={slug} />
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}
