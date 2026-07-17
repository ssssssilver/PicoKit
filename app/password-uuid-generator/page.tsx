import type { Metadata } from "next"
import { KeyRound } from "lucide-react"

import { PasswordUuidTool } from "@/components/password-uuid-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费密码与 UUID 生成器", description: "使用 Web Crypto 在浏览器本地生成安全随机密码和 UUID v4，不上传任何内容。" }
export default function Page() { return <ToolShell title={{ zh: "密码与 UUID 生成器", en: "Password and UUID Generator" }} description={{ zh: "使用系统级随机数生成密码和 UUID，支持字符规则、混淆字符过滤、批量复制。", en: "Generate passwords and UUIDs with system-grade randomness, configurable character rules, ambiguity filtering, and bulk copy." }} eyebrow="Local Secure Generator" icon={KeyRound} aside={<ToolAside notes={[{ zh: "随机数来自浏览器 Web Crypto", en: "Randomness comes from Web Crypto" }, { zh: "密码不会写入本地存储", en: "Passwords are not stored locally" }, { zh: "请使用可信密码管理器保存结果", en: "Use a trusted password manager to save results" }]} />}><PasswordUuidTool /></ToolShell> }
