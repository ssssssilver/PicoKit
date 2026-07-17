"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eraser,
  FileArchive,
  LoaderCircle,
  ScanSearch,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileDropzone, formatBytes } from "@/components/file-dropzone";
import { inspectImage } from "@/lib/image-inspector";
import { downloadBlob, sanitizeImage } from "@/lib/image-sanitizer";
import type {
  ImageInspection,
  SanitizeMode,
  SanitizeResult,
} from "@/lib/image-types";

const copy: Record<
  SanitizeMode,
  {
    action: string;
    actionEn: string;
    empty: string;
    emptyEn: string;
    warning: string;
    warningEn: string;
  }
> = {
  ai: {
    action: "清理 AI 元数据",
    actionEn: "Remove AI metadata",
    empty: "没有发现已知 AI 生成器或工作流字段",
    emptyEn: "No known AI generator or workflow fields were found",
    warning:
      "会移除命中的 AI 生成器/XMP/IPTC 段；复杂混合段可能同时包含其他描述字段。",
    warningEn:
      "Matched AI generator, XMP, or IPTC segments will be removed. Complex mixed segments may also contain other descriptive fields.",
  },
  c2pa: {
    action: "清理 C2PA",
    actionEn: "Remove C2PA",
    empty: "没有发现 C2PA/JUMBF 容器信号",
    emptyEn: "No C2PA/JUMBF container signal was found",
    warning:
      "C2PA 是来源凭证。清理前建议保留原文件；操作不会删除 SynthID 等像素水印。",
    warningEn:
      "C2PA stores provenance credentials. Keep the source file before cleaning; this does not remove pixel watermarks such as SynthID.",
  },
  label: {
    action: "清理 AI 标签信号",
    actionEn: "Remove AI label signals",
    empty: "没有发现 DigitalSourceType 或 Made with AI 字段",
    emptyEn: "No DigitalSourceType or Made with AI field was found",
    warning: "平台可能同时使用像素分类器；清理元数据不能保证平台标签消失。",
    warningEn:
      "Platforms may also use pixel classifiers. Removing metadata cannot guarantee that a platform label disappears.",
  },
  all: {
    action: "清理全部可移除元数据",
    actionEn: "Remove all removable metadata",
    empty: "没有发现可移除元数据",
    emptyEn: "No removable metadata was found",
    warning: "会移除 EXIF/XMP/IPTC/C2PA 等容器数据，但尽量保留 ICC 色彩配置。",
    warningEn:
      "EXIF, XMP, IPTC, C2PA, and similar container data will be removed while preserving ICC color profiles where possible.",
  },
};

export function MetadataCleanerTool({ mode }: { mode: SanitizeMode }) {
  const { language, pick } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<ImageInspection | null>(null);
  const [postInspection, setPostInspection] = useState<ImageInspection | null>(
    null,
  );
  const [result, setResult] = useState<SanitizeResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    inspectImage(file)
      .then((value) => {
        if (!cancelled) setInspection(value);
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            pick(
              reason instanceof Error ? reason.message : "解析失败",
              "Unable to inspect this image container.",
            ),
          );
      })
      .finally(() => {
        if (!cancelled) setRunning(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file, language, pick]);

  function handleFile(next: File | null) {
    setFile(next);
    setInspection(null);
    setPostInspection(null);
    setResult(null);
    setConfirmed(false);
    setError("");
    setRunning(Boolean(next));
  }

  async function clean() {
    if (!file || !confirmed) return;
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const cleaned = await sanitizeImage(file, mode);
      setResult(cleaned);
      const cleanedFile = new File([cleaned.blob], file.name, {
        type: cleaned.blob.type,
      });
      setPostInspection(await inspectImage(cleanedFile));
    } catch (reason) {
      setError(
        pick(
          reason instanceof Error ? reason.message : "清理失败",
          "Metadata cleaning failed. Keep the source file and try another supported format.",
        ),
      );
    } finally {
      setRunning(false);
    }
  }

  const expectedSignals =
    inspection?.signals.filter((signal) =>
      mode === "c2pa"
        ? signal.group === "c2pa"
        : mode === "all" ||
          signal.group === "ai" ||
          signal.group === "software",
    ) ?? [];

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <FileDropzone file={file} onFile={handleFile} disabled={running} />
          {running && !result ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="size-4 animate-spin" />
              {pick(
                "正在本地读取文件容器…",
                "Reading the file container locally…",
              )}
            </p>
          ) : null}
          {error ? (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle />
              <AlertTitle>{pick("处理失败", "Processing failed")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {inspection ? (
        <Card className="border-slate-200 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScanSearch className="size-4 text-cyan-700" />
              {pick("清理前预览", "Preview before cleaning")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Info label={pick("格式", "Format")} value={inspection.format} />
              <Info
                label={pick("大小", "Size")}
                value={formatBytes(inspection.bytes)}
              />
              <Info
                label={pick("元数据", "Metadata")}
                value={`${inspection.metadata.length} ${pick("项", "items")}`}
              />
              <Info
                label={pick("目标信号", "Target signals")}
                value={`${expectedSignals.length} ${pick("项", "items")}`}
              />
            </div>
            {expectedSignals.length ? (
              <div className="space-y-2">
                {expectedSignals.map((signal) => (
                  <div
                    key={signal.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{signal.label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {signal.value}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {pick("将处理", "Will process")}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                {pick(copy[mode].empty, copy[mode].emptyEn)}
                {pick(
                  "。你仍可执行容器级复检/清理。",
                  ". You can still run a container-level recheck and cleanup.",
                )}
              </p>
            )}
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle />
              <AlertTitle>{pick("处理边界", "Processing boundary")}</AlertTitle>
              <AlertDescription>
                {pick(copy[mode].warning, copy[mode].warningEn)}
              </AlertDescription>
            </Alert>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm leading-6">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(value) => setConfirmed(Boolean(value))}
                className="mt-1"
              />
              <span>
                {pick(
                  "我拥有处理此文件的权利，理解来源字段清理不等于改变图片真实来源，并会自行保留需要的原文件。",
                  "I have the right to process this file, understand that removing provenance fields does not change the image's real origin, and will keep any source file I need.",
                )}
              </span>
            </label>
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={clean}
                disabled={!confirmed || running}
              >
                {running ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Eraser />
                )}
                {pick(copy[mode].action, copy[mode].actionEn)}
              </Button>
              {file ? (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => downloadBlob(file, `backup-${file.name}`)}
                >
                  <FileArchive />
                  {pick("下载原文件备份", "Download source backup")}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <Card className="border-emerald-200 bg-emerald-50/40 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-emerald-900">
              <CheckCircle2 className="size-5" />
              {pick("本地清理完成", "Local cleanup complete")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Info
                label={pick("移除容器", "Removed containers")}
                value={`${result.removed.length} ${pick("类", "types")}`}
              />
              <Info
                label={pick("像素载荷", "Pixel payload")}
                value={
                  result.pixelsPreserved
                    ? pick("哈希一致", "Hash matched")
                    : pick("需要复核", "Review required")
                }
              />
              <Info
                label={pick("复检信号", "Signals after check")}
                value={
                  postInspection
                    ? `${postInspection.signals.filter((signal) => signal.group === "ai" || signal.group === "c2pa").length} ${pick("项", "items")}`
                    : pick("复检中", "Rechecking")
                }
              />
              <Info
                label={pick("结果大小", "Result size")}
                value={formatBytes(result.blob.size)}
              />
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-emerald-700">
                {pick("已处理", "Processed")}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {result.removed.length
                  ? result.removed.join(language === "zh-CN" ? "、" : ", ")
                  : pick(
                      "没有发现匹配的容器段，输出与原容器等价。",
                      "No matching container segment was found; the output is container-equivalent to the source.",
                    )}
              </p>
              <p className="mt-3 break-all font-mono text-[10px] text-slate-400">
                Pixel payload SHA-256: {result.afterPayloadHash}
              </p>
            </div>
            {!result.pixelsPreserved ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertTitle>
                  {pick(
                    "像素载荷校验未通过",
                    "Pixel-payload verification failed",
                  )}
                </AlertTitle>
                <AlertDescription>
                  {pick(
                    "不要使用这个结果；请保留原文件并提交格式样本。",
                    "Do not use this result. Keep the source file and submit a format sample for review.",
                  )}
                </AlertDescription>
              </Alert>
            ) : null}
            <Button
              size="lg"
              onClick={() =>
                file &&
                downloadBlob(
                  result.blob,
                  `${file.name.replace(/\.[^.]+$/, "")}-${mode}-cleaned.${extensionFor(result.blob.type)}`,
                )
              }
              disabled={!result.pixelsPreserved}
            >
              <Download />
              {pick("下载清理结果", "Download cleaned result")}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
function extensionFor(mime: string) {
  return mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
}
