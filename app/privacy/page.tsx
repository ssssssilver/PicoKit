import type { Metadata } from "next"

import { ContentPage } from "@/components/content-page"
import { Localized } from "@/components/localized"

export const metadata: Metadata = { title: "隐私说明", description: "TabNative 的本地文件处理、浏览器缓存、匿名统计和广告数据边界。" }

export default function Page() {
  return <ContentPage eyebrow="Privacy" title={{ zh: "内容不离开你的设备", en: "Your content never leaves your device" }} intro={{ zh: "隐私不是一句宣传语，而是处理架构的边界：服务端没有接收原始内容的接口。", en: "Privacy is an architectural boundary, not a slogan: the server has no endpoint that accepts source content." }}>
    <section>
      <h2><Localized zh="我们不接收什么" en="What we never receive" /></h2>
      <ul className="mt-4">
        <li><Localized zh="原始文本、文件名、图片像素、3D 模型、材质、贴图或场景数据；" en="Source text, filenames, image pixels, 3D models, materials, textures, or scene data." /></li>
        <li><Localized zh="EXIF/XMP/C2PA 内容、处理结果、Canvas 数据、文本片段和模型原始输出；" en="EXIF/XMP/C2PA contents, processing results, canvas data, text segments, or raw model output." /></li>
        <li><Localized zh="人脸特征、图片指纹或完整内容哈希。" en="Face features, image fingerprints, or full-content hashes." /></li>
      </ul>
    </section>
    <section>
      <h2><Localized zh="浏览器本地保存" en="Local browser storage" /></h2>
      <p className="mt-3"><Localized zh="模型和 WASM 文件可能存入浏览器 Cache Storage，以便后续更快启动或离线使用。工具设置可以存入 localStorage。用户图片、3D 文件与处理结果通常只存在当前页面内存和临时 Blob URL，页面释放后不再保留。PDF 工作台只有在你主动点击“保存本地草稿”后，才会把 PDF 与设置写入此浏览器的 IndexedDB；草稿可手动清除并会在 7 天后失效。" en="Models and WASM files may be cached in browser Cache Storage for faster startup or offline use. Tool settings may be stored in localStorage. Images, 3D files, and results normally exist only in page memory and temporary Blob URLs and are released with the page. The PDF workspace writes PDFs and settings to this browser's IndexedDB only after you explicitly choose Save local draft; drafts can be cleared manually and expire after 7 days." /></p>
    </section>
    <section>
      <h2><Localized zh="匿名分析" en="Anonymous analytics" /></h2>
      <p className="mt-3"><Localized zh="若启用匿名分析，只允许记录工具类型、设备后端、文件大小区间、耗时区间和成功/失败状态。事件不得包含文本、文件名、图片、3D 内容或可还原用户内容的数据。" en="If anonymous analytics are enabled, they may record only the tool type, device backend, file-size range, duration range, and success/failure state. Events must never include text, filenames, image or 3D content, or data that could reconstruct user content." /></p>
    </section>
    <section>
      <h2><Localized zh="广告" en="Advertising" /></h2>
      <p className="mt-3"><Localized zh="第三方广告可能根据浏览器和页面访问收集信息。广告组件与工具组件隔离，不能获得 File、Blob、Canvas、3D 场景或文本状态。选择、处理与下载按钮附近不放置广告。" en="Third-party ads may collect browser and page-visit information. Ad components are isolated from tool components and cannot access File, Blob, Canvas, 3D scene, or text state. Ads are not placed beside selection, processing, or download controls." /></p>
    </section>
  </ContentPage>
}
