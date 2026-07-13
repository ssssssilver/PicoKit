import type { Metadata } from "next"

import { ContentPage } from "@/components/content-page"

export const metadata: Metadata = { title: "使用条款", description: "LocalProof 的合法使用范围、结果限制与用户责任。" }

export default function Page() { return <ContentPage eyebrow="Terms" title="合法使用与结果边界" intro="使用工具前，请确认你有权处理相关文件，并理解检测结果与清理操作的限制。">
  <section><h2>允许的用途</h2><ul className="mt-4"><li>检查你拥有或获授权处理的文本、图片和来源凭证；</li><li>清理个人隐私元数据、处理自己的生成图片角标；</li><li>研究、教育、内容审核辅助和格式转换。</li></ul></section>
  <section><h2>禁止的用途</h2><ul className="mt-4"><li>移除图库预览、摄影师署名或其他第三方版权水印；</li><li>把清理后的文件虚假陈述为真人原创、相机原片或未使用 AI；</li><li>仅凭检测分数对学生、作者或求职者实施处罚；</li><li>任何违反当地法律、平台规则或合同义务的用途。</li></ul></section>
  <section><h2>无保证</h2><p className="mt-3">本地模型和解析器可能出现误判、漏检或格式兼容问题。用户应保留原文件并自行复核。LocalProof 不保证第三方平台接受处理结果或改变其标签判断。</p></section>
</ContentPage> }

