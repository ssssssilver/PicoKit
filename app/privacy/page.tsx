import type { Metadata } from "next"

import { ContentPage } from "@/components/content-page"

export const metadata: Metadata = { title: "隐私说明", description: "LocalProof 的本地文件处理、浏览器缓存、匿名统计和广告数据边界。" }

export default function Page() { return <ContentPage eyebrow="Privacy" title="内容不离开你的设备" intro="隐私不是一句宣传语，而是处理架构的边界：服务端没有接收原始内容的接口。">
  <section><h2>我们不接收什么</h2><ul className="mt-4"><li>原始文本、文件名、图片像素、EXIF/XMP/C2PA 内容；</li><li>处理结果、Canvas 数据、文本片段和模型原始输出；</li><li>人脸特征、图片指纹或完整内容哈希。</li></ul></section>
  <section><h2>浏览器本地保存</h2><p className="mt-3">模型和 WASM 文件可能存入浏览器 Cache Storage，以便后续更快启动或离线使用。工具设置可以存入 localStorage。用户文件与处理结果只存在当前页面内存和临时 Blob URL，页面释放后不再保留。</p></section>
  <section><h2>匿名分析</h2><p className="mt-3">若启用匿名分析，只允许记录工具类型、设备后端、文件大小区间、耗时区间和成功/失败状态。事件不得包含文本、文件名、图片内容或可还原用户内容的数据。</p></section>
  <section><h2>广告</h2><p className="mt-3">第三方广告可能根据浏览器和页面访问收集信息。广告组件与工具组件隔离，不能获得 File、Blob、Canvas 或文本状态。上传、处理与下载按钮附近不放置广告。</p></section>
</ContentPage> }

