import type { Metadata } from "next"

import { ContentPage } from "@/components/content-page"
import { Localized } from "@/components/localized"

export const metadata: Metadata = { title: "隐私说明", description: "了解 TabNative 如何在浏览器中处理文件，以及匿名统计和广告能看到哪些信息。" }

export default function Page() {
  return <ContentPage eyebrow="Privacy" title={{ zh: "文件只在你的设备上处理", en: "Your content never leaves your device" }} intro={{ zh: "你选择的文件和处理结果不会上传到 TabNative 服务端。下面说明浏览器会临时保存什么，以及广告和匿名统计能看到什么。", en: "Privacy is an architectural boundary, not a slogan: the server has no endpoint that accepts source content." }}>
    <section>
      <h2><Localized zh="我们不接收什么" en="What we never receive" /></h2>
      <ul className="mt-4">
        <li><Localized zh="原始文本、文件名、图片、PDF、音视频或 3D 模型；" en="Source text, filenames, image pixels, 3D models, materials, textures, or scene data." /></li>
        <li><Localized zh="图片中的元数据、处理结果、编辑内容或检测明细；" en="EXIF/XMP/C2PA contents, processing results, canvas data, text segments, or raw model output." /></li>
        <li><Localized zh="人脸特征、图片指纹或可用于还原原文件的数据。" en="Face features, image fingerprints, or full-content hashes." /></li>
      </ul>
    </section>
    <section>
      <h2><Localized zh="浏览器本地保存" en="Local browser storage" /></h2>
      <p className="mt-3"><Localized zh="浏览器可能保存工具所需文件和你的常用设置，让下次打开更快。图片、3D 模型和处理结果通常只在当前页面临时使用，关闭页面后不再保留。只有你主动点击“保存本地草稿”时，PDF 和设置才会保存在当前浏览器中；草稿可以手动清除，并会在 7 天后失效。" en="Models and WASM files may be cached in browser Cache Storage for faster startup or offline use. Tool settings may be stored in localStorage. Images, 3D files, and results normally exist only in page memory and temporary Blob URLs and are released with the page. The PDF workspace writes PDFs and settings to this browser's IndexedDB only after you explicitly choose Save local draft; drafts can be cleared manually and expire after 7 days." /></p>
    </section>
    <section>
      <h2><Localized zh="匿名分析" en="Anonymous analytics" /></h2>
      <p className="mt-3"><Localized zh="如果启用匿名统计，只会记录使用了哪个工具、文件大小范围、处理时长和是否成功。统计中不会包含文本、文件名、图片、3D 内容或其他可还原原文件的数据。" en="If anonymous analytics are enabled, they may record only the tool type, device backend, file-size range, duration range, and success/failure state. Events must never include text, filenames, image or 3D content, or data that could reconstruct user content." /></p>
    </section>
    <section>
      <h2><Localized zh="广告" en="Advertising" /></h2>
      <p className="mt-3"><Localized zh="第三方广告可能收集浏览器类型和页面访问等信息，但广告区域无法读取你选择的文件、编辑内容或处理结果。文件选择、处理和下载按钮附近不会放置广告。" en="Third-party ads may collect browser and page-visit information. Ad components are isolated from tool components and cannot access File, Blob, Canvas, 3D scene, or text state. Ads are not placed beside selection, processing, or download controls." /></p>
    </section>
  </ContentPage>
}
