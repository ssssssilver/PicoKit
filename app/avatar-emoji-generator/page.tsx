import type { Metadata } from "next"
import { Smile } from "lucide-react"

import { AvatarEmojiTool } from "@/components/avatar-emoji-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = { title: "免费头像与团队表情生成器", description: "使用文字或本地图片生成圆形、圆角或方形头像，并导出 512 和 128 像素透明 PNG。" }
export default function Page() { return <ToolShell title={{ zh: "头像与团队表情生成器", en: "Avatar and Team Emoji Generator" }} description={{ zh: "用短文字或本地图片制作圆形、圆角或方形头像，并导出常用 PNG 尺寸。", en: "Create circular, rounded, or square avatars from short text or a local image and export common PNG sizes." }} eyebrow="Local Avatar Generator" icon={Smile} aside={<ToolAside notes={[{ zh: "适合头像、群组图标和静态表情", en: "Designed for avatars, group icons, and static emoji" }, { zh: "支持背景色和安全边距", en: "Background color and safe padding are supported" }, { zh: "动画内容请使用 GIF 工具", en: "Use the GIF toolkit for animation" }]} />}><AvatarEmojiTool /></ToolShell> }
