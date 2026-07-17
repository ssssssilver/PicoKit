"use client";

import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Clock3,
  LockKeyhole,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import { useMyTools } from "@/components/use-my-tools";
import { matchesLocalizedQuery } from "@/lib/localized-search";
import {
  allTools,
  commonTools,
  toolCategories,
  type SiteTool,
  type ToolCategory,
} from "@/lib/site";

type DirectoryView = "common" | "mine" | "all" | ToolCategory;

export function HomeToolDirectory() {
  const { pick, format } = useLanguage();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<DirectoryView>("common");
  const [showMore, setShowMore] = useState(false);
  const {
    state: myToolsState,
    favoriteHrefs,
    myToolHrefs,
    toggleFavorite,
    clearRecent,
    clearAll,
  } = useMyTools();
  const inputRef = useRef<HTMLInputElement>(null);
  const normalized = query.trim().toLowerCase();
  const myTools = useMemo(
    () =>
      myToolHrefs
        .map((href) => allTools.find((tool) => tool.href === href))
        .filter((tool): tool is SiteTool => Boolean(tool)),
    [myToolHrefs],
  );

  const tools = useMemo(() => {
    const source =
      view === "mine"
        ? myTools
        : view === "common" && !normalized
          ? commonTools
          : allTools;
    return source.filter((tool) => {
      const matchesCategory =
        view === "common" ||
        view === "mine" ||
        view === "all" ||
        tool.category === view;
      const categoryDetails = toolCategories.find(
        (item) => item.id === tool.category,
      );
      const matchesQuery = matchesLocalizedQuery(
        normalized,
        [
          { zh: tool.title, en: tool.titleEn },
          { zh: tool.description, en: tool.descriptionEn },
          ...(categoryDetails
            ? [
                { zh: categoryDetails.title, en: categoryDetails.titleEn },
                {
                  zh: categoryDetails.description,
                  en: categoryDetails.descriptionEn,
                },
              ]
            : []),
        ],
        pick,
      );
      return matchesCategory && matchesQuery;
    });
  }, [myTools, normalized, pick, view]);

  const groups = useMemo(() => {
    if (view === "mine")
      return tools.length
        ? [
            {
              id: "mine",
              title: "My tools",
              titleEn: "My tools",
              titleZh: "我的工具",
              description: "收藏与最近使用的工具，仅保存在当前浏览器",
              descriptionEn:
                "Favorites and recently used tools, stored only in this browser",
              tools,
            },
          ]
        : [];
    if (view === "common" && !normalized)
      return [
        {
          id: "common",
          title: "Common tools",
          titleEn: "Common tools",
          titleZh: "常用工具",
          description: "优先展示最常处理的图片、PDF、AI 检测与二维码任务",
          descriptionEn:
            "Quick access to common image, PDF, AI detection, and QR tasks",
          tools,
        },
      ];
    return toolCategories
      .map((item) => ({
        ...item,
        titleZh: item.title,
        tools: tools.filter((tool) => tool.category === item.id),
      }))
      .filter((item) => item.tools.length > 0);
  }, [normalized, tools, view]);

  function resetDirectory() {
    setQuery("");
    setView("common");
    setShowMore(false);
  }

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.key === "/" && !target?.matches("input, textarea, select")) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (
        event.key === "Escape" &&
        document.activeElement === inputRef.current
      ) {
        setQuery("");
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    function applyHashView() {
      const hash = window.location.hash;
      if (hash === "#my-tools") {
        setView("mine");
        setShowMore(false);
        return;
      }
      if (hash === "#tools" || hash === "") {
        setView("common");
        setShowMore(false);
        return;
      }
      const category = hash.match(/^#tools-(.+)$/)?.[1] as
        ToolCategory | undefined;
      if (category && toolCategories.some((item) => item.id === category)) {
        setView(category);
        setShowMore(true);
      }
    }
    function applyClickedHash(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href*='#']");
      if (!anchor) return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin !== window.location.origin ||
        destination.pathname !== window.location.pathname
      )
        return;
      // Next's client-side Link navigation updates the hash through history.pushState,
      // which does not consistently emit a native hashchange event.
      window.requestAnimationFrame(applyHashView);
    }
    applyHashView();
    window.addEventListener("hashchange", applyHashView);
    window.addEventListener("popstate", applyHashView);
    document.addEventListener("click", applyClickedHash);
    return () => {
      window.removeEventListener("hashchange", applyHashView);
      window.removeEventListener("popstate", applyHashView);
      document.removeEventListener("click", applyClickedHash);
    };
  }, []);

  return (
    <section
      id="tools"
      className="mx-auto max-w-[1280px] scroll-mt-24 px-5 pb-16 pt-8 sm:px-8 lg:pb-20"
    >
      <span
        id="my-tools"
        className="pointer-events-none block h-0 scroll-mt-24"
        aria-hidden="true"
      />
      <div className="border-b border-white/10 pb-7">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[.2em] text-cyan-300">
            {pick("工具目录", "Tool directory")}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-.035em] text-white sm:text-3xl">
            {pick("选择要完成的任务", "Choose a task")}
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            {format("先展示 {common} 个常用工具，其余 {more} 个按分类展开", "{common} common tools first; expand {more} more by category", { common: commonTools.length, more: allTools.length - commonTools.length })}
          </p>
        </div>
      </div>

      <label className="mt-7 flex h-14 items-center gap-4 rounded-lg border border-white/15 bg-white/[.025] px-4 transition focus-within:border-cyan-300/50 focus-within:ring-4 focus-within:ring-cyan-300/5">
        <Search className="size-5 shrink-0 text-zinc-500" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          placeholder={pick(
            "搜索工具、格式或功能…",
            "Search tools, formats, or features…",
          )}
          aria-label={pick("搜索 TabNative 工具", "Search TabNative tools")}
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-white/5 hover:text-white"
            aria-label={pick("清空搜索", "Clear search")}
          >
            <X className="size-4" />
          </button>
        ) : (
          <kbd className="hidden rounded-md border border-white/15 px-2 py-1 font-mono text-xs text-zinc-500 sm:block">
            /
          </kbd>
        )}
      </label>

      <div
        className="mt-5 flex flex-wrap items-center gap-2"
        aria-label={pick("工具导航", "Tool navigation")}
      >
        <CategoryButton
          active={view === "common"}
          onClick={() => setView("common")}
          label={pick("常用工具", "Common tools")}
          count={commonTools.length}
        />
        <CategoryButton
          active={view === "mine"}
          onClick={() => setView("mine")}
          label={pick("我的工具", "My tools")}
          count={myToolHrefs.length}
          icon={<Star className="size-3.5" />}
        />
        <button
          type="button"
          onClick={() =>
            setShowMore((value) => {
              const nextValue = !value;
              if (!nextValue) setView("common");
              return nextValue;
            })
          }
          aria-expanded={showMore}
          aria-controls="more-tool-categories"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3.5 text-sm text-zinc-500 transition hover:border-white/20 hover:text-zinc-200"
        >
          {pick("更多工具与分类", "More tools and categories")}
          <span className="font-mono text-[10px] opacity-60">
            {allTools.length - commonTools.length}
          </span>
          <ChevronDown
            className={`size-4 transition-transform ${showMore ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {showMore ? (
        <div
          id="more-tool-categories"
          className="mt-3 flex flex-wrap gap-2 border-l-2 border-cyan-300/20 pl-3"
        >
          <CategoryButton
            active={view === "all"}
            onClick={() => setView("all")}
            label={pick("全部工具", "All tools")}
            count={allTools.length}
          />
          {toolCategories.map((item) => (
            <CategoryButton
              key={item.id}
              active={view === item.id}
              onClick={() => setView(item.id)}
              label={pick(item.title, item.titleEn)}
              count={
                allTools.filter((tool) => tool.category === item.id).length
              }
            />
          ))}
        </div>
      ) : null}

      <div className="mt-8 space-y-10">
        {groups.length ? (
          groups.map((group) => (
            <section
              key={group.id}
              id={`tools-${group.id}`}
              className="scroll-mt-28"
              aria-labelledby={`category-${group.id}-title`}
            >
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h3
                    id={`category-${group.id}-title`}
                    className="text-lg font-semibold text-zinc-100"
                  >
                    {pick(group.titleZh, group.titleEn)}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-600">
                    {pick(group.description, group.descriptionEn)}
                  </p>
                </div>
                {group.id === "mine" ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {myToolsState.recent.length ? (
                      <button
                        type="button"
                        onClick={clearRecent}
                        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] text-zinc-500 transition hover:border-white/20 hover:text-zinc-200"
                      >
                        <Clock3 className="size-3.5" />
                        {pick("清除最近使用", "Clear recent")}
                      </button>
                    ) : null}
                    {myToolHrefs.length ? (
                      <button
                        type="button"
                        onClick={clearAll}
                        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] text-zinc-500 transition hover:border-rose-400/30 hover:text-rose-300"
                      >
                        <Trash2 className="size-3.5" />
                        {pick("清空", "Clear all")}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-[.14em] text-zinc-600">
                    {group.tools.length} {pick("个工具", "tools")}
                  </span>
                )}
              </div>
              <div className="grid border-l border-t border-white/15 md:grid-cols-2 xl:grid-cols-3">
                {group.tools.map((tool) => (
                  <ToolCard
                    key={tool.href}
                    tool={tool}
                    isFavorite={favoriteHrefs.has(tool.href)}
                    isRecent={myToolsState.recent.some(
                      (item) => item.href === tool.href,
                    )}
                    onToggleFavorite={() => toggleFavorite(tool.href)}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="border border-white/10 px-5 py-14 text-center">
            {view === "mine" && !normalized ? (
              <Star className="mx-auto size-7 text-zinc-700" />
            ) : null}
            <p className="mt-3 text-sm text-zinc-400">
              {view === "mine" && !normalized
                ? pick(
                    "还没有收藏或最近使用的工具",
                    "No favorites or recently used tools yet",
                  )
                : pick("没有匹配的工具", "No matching tools")}
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-zinc-600">
              {view === "mine" && !normalized
                ? pick(
                    "打开任意工具会自动出现在这里；点击工具卡右上角的星标可长期收藏。",
                    "Open any tool to add it here automatically, or use the star on a tool card to keep it in favorites.",
                  )
                : pick(
                    "请尝试其他关键词，或返回常用工具。",
                    "Try another keyword, or return to common tools.",
                  )}
            </p>
            <button
              type="button"
              onClick={resetDirectory}
              className="mt-4 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
            >
              {pick("浏览常用工具", "Browse common tools")}
            </button>
          </div>
        )}
      </div>

      <p className="mt-8 flex items-start gap-2 text-xs leading-5 text-zinc-600">
        <LockKeyhole className="mt-0.5 size-4 shrink-0" />
        {pick(
          "工具在浏览器中运行。文件不会发送到 TabNative 服务端，广告区域也无法读取处理中的文件。",
          "Tools run in the browser. Files are not sent to TabNative servers, and ad areas cannot read files being processed.",
        )}
      </p>
    </section>
  );
}

function CategoryButton({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm transition ${active ? "border-cyan-300/40 bg-cyan-300/[.08] text-cyan-200" : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-200"}`}
    >
      {icon}
      {label}
      <span className="font-mono text-[10px] opacity-60">{count}</span>
    </button>
  );
}

function ToolCard({
  tool,
  isFavorite,
  isRecent,
  onToggleFavorite,
}: {
  tool: SiteTool;
  isFavorite: boolean;
  isRecent: boolean;
  onToggleFavorite: () => void;
}) {
  const { pick, format } = useLanguage();
  const Icon = tool.icon;
  const title = pick(tool.title, tool.titleEn);
  return (
    <article className="group relative min-h-[148px] border-b border-r border-white/15 transition hover:z-10 hover:bg-white/[.035]">
      <Link
        href={tool.href}
        className="grid min-h-[148px] grid-cols-[42px_1fr_auto] gap-4 p-5 pr-14 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300/50 sm:p-6 sm:pr-16"
      >
        <span className="grid size-10 place-items-center rounded-lg border border-white/10 bg-white/[.025] text-zinc-300 transition group-hover:border-cyan-300/25 group-hover:text-cyan-300">
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="block text-base font-semibold text-zinc-100">
              {title}
            </span>
            {isFavorite ? (
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[.06] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.1em] text-cyan-300">
                {pick("已收藏", "Saved")}
              </span>
            ) : isRecent ? (
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.1em] text-zinc-600">
                {pick("最近使用", "Recent")}
              </span>
            ) : null}
          </span>
          <span className="mt-2 block text-sm leading-6 text-zinc-500">
            {pick(tool.description, tool.descriptionEn)}
          </span>
          <span className="mt-4 block font-mono text-[10px] uppercase tracking-[.1em] text-zinc-600">
            {tool.runtime ?? "BROWSER WORKER"}
          </span>
        </span>
        <ArrowRight className="mt-1 size-4 text-zinc-700 transition group-hover:translate-x-1 group-hover:text-cyan-300" />
      </Link>
      <button
        type="button"
        onClick={onToggleFavorite}
        aria-pressed={isFavorite}
        aria-label={
          isFavorite
            ? format("取消收藏{name}", "Remove {name} from favorites", {
                name: title,
              })
            : format("收藏{name}到我的工具", "Save {name} to My tools", {
                name: title,
              })
        }
        title={
          isFavorite
            ? pick("取消收藏", "Remove from favorites")
            : pick("收藏到我的工具", "Save to My tools")
        }
        className={`absolute right-3 top-3 z-20 grid size-9 place-items-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40 ${isFavorite ? "border-cyan-300/30 bg-cyan-300/[.09] text-cyan-300" : "border-white/10 bg-[#0b0b0b]/80 text-zinc-600 hover:border-white/20 hover:text-zinc-200"}`}
      >
        <Star className="size-4" fill={isFavorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
