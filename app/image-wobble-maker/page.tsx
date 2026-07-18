import type { Metadata } from "next"
import { Waves } from "lucide-react"

import { ImageWobbleTool } from "@/components/image-wobble-tool"
import { ToolAside } from "@/components/tool-aside"
import { ToolShell } from "@/components/tool-shell"

export const metadata: Metadata = {
  title: "图片晃动动画：局部涂抹并导出 GIF 或视频",
  description: "在浏览器本地涂抹图片中需要运动的区域，实时预览弹性晃动，并导出 GIF、WebM 或浏览器支持的 MP4。",
}

export default function Page() {
  return (
    <ToolShell
      title={{ zh: "图片晃动动画", en: "Image Wobble Animator" }}
      description={{
        zh: "涂出图片中需要运动的区域，实时调整摇摆、弹跳或绕圈效果，再在本地生成 GIF 或视频。适合头像、贴纸、插画、头发和衣摆等局部动态。",
        en: "Paint the areas that should move, tune sway, hop, or orbit motion in real time, then create a GIF or video locally. Ideal for avatars, stickers, illustrations, hair, and fabric.",
      }}
      eyebrow="Local Image Wobble Animator"
      icon={Waves}
      processingLabel={{ zh: "使用本机 Canvas 与媒体编码器", en: "Uses local Canvas and media encoders" }}
      aside={<ToolAside notes={[
        { zh: "优先涂抹与主体相连的柔软区域，如头发、衣摆、耳朵或装饰", en: "Start with flexible areas attached to the subject, such as hair, fabric, ears, or decorations" },
        { zh: "遮罩边缘越柔和，晃动与静止区域的衔接越自然", en: "Softer mask edges create a more natural transition between moving and still areas" },
        { zh: "GIF 最长边限制为 640 px；WebM 或 MP4 可使用更高分辨率", en: "GIF is capped at 640 px on the longest side; WebM or MP4 can use higher resolutions" },
        { zh: "MP4 是否可用取决于当前浏览器编码能力，不可用时请选择 WebM 或 GIF", en: "MP4 availability depends on your browser's encoder; use WebM or GIF when it is unavailable" },
      ]} />}
    >
      <ImageWobbleTool />
    </ToolShell>
  )
}
