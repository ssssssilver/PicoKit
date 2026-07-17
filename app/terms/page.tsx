import type { Metadata } from "next"

import { ContentPage } from "@/components/content-page"
import { Localized } from "@/components/localized"

export const metadata: Metadata = { title: "使用条款", description: "TabNative 的合法使用范围、结果限制与用户责任。" }

export default function Page() {
  return <ContentPage eyebrow="Terms" title={{ zh: "合法使用与结果边界", en: "Lawful use and result boundaries" }} intro={{ zh: "使用工具前，请确认你有权处理相关文件，并理解检测结果与清理操作的限制。", en: "Before using a tool, confirm that you have the right to process the file and understand the limits of detection and cleanup operations." }}>
    <section>
      <h2><Localized zh="允许的用途" en="Allowed uses" /></h2>
      <ul className="mt-4">
        <li><Localized zh="检查你拥有或获授权处理的文本、图片和来源凭证；" en="Inspect text, images, and provenance credentials that you own or are authorized to process." /></li>
        <li><Localized zh="清理个人隐私元数据、处理自己的生成图片角标；" en="Remove personal privacy metadata or process visible marks on your own generated images." /></li>
        <li><Localized zh="研究、教育、内容审核辅助和格式转换。" en="Research, education, content-review assistance, and format conversion." /></li>
      </ul>
    </section>
    <section>
      <h2><Localized zh="禁止的用途" en="Prohibited uses" /></h2>
      <ul className="mt-4">
        <li><Localized zh="移除图库预览、摄影师署名或其他第三方版权水印；" en="Removing stock-preview marks, photographer signatures, or other third-party copyright watermarks." /></li>
        <li><Localized zh="把清理后的文件虚假陈述为真人原创、相机原片或未使用 AI；" en="Misrepresenting a cleaned file as human-made, camera-original, or created without AI." /></li>
        <li><Localized zh="仅凭检测分数对学生、作者或求职者实施处罚；" en="Penalizing students, authors, or candidates based only on a detector score." /></li>
        <li><Localized zh="任何违反当地法律、平台规则或合同义务的用途。" en="Any use that violates local law, platform rules, or contractual obligations." /></li>
      </ul>
    </section>
    <section>
      <h2><Localized zh="无保证" en="No guarantee" /></h2>
      <p className="mt-3"><Localized zh="本地模型和解析器可能出现误判、漏检或格式兼容问题。用户应保留原文件并自行复核。TabNative 不保证第三方平台接受处理结果或改变其标签判断。" en="Local models and parsers can produce false positives, missed detections, or format-compatibility problems. Keep the source file and review results yourself. TabNative does not guarantee that third-party platforms will accept a result or change their labeling decision." /></p>
    </section>
  </ContentPage>
}
