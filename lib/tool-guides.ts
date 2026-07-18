import { allTools, getCategory, type ToolCategory } from "@/lib/site"

export type LocalizedGuideText = { zh: string; en: string }
export type ToolGuideStep = LocalizedGuideText & { titleZh: string; titleEn: string }
export type ToolGuideDetails = {
  prerequisites: LocalizedGuideText[]
  steps: ToolGuideStep[]
  verification: LocalizedGuideText[]
  troubleshooting: LocalizedGuideText[]
  readMinutes: number
}

export type ToolGuide = ToolGuideDetails & {
  slug: string
  href: string
  title: string
  titleEn: string
  description: string
  descriptionEn: string
  category: ToolCategory
  categoryTitle: string
  categoryTitleEn: string
  runtime?: string
}

const text = (zh: string, en: string): LocalizedGuideText => ({ zh, en })
const step = (titleZh: string, titleEn: string, zh: string, en: string): ToolGuideStep => ({ titleZh, titleEn, zh, en })
const guide = (
  prerequisites: LocalizedGuideText[],
  steps: ToolGuideStep[],
  verification: LocalizedGuideText[],
  troubleshooting: LocalizedGuideText[],
  readMinutes = 5,
): ToolGuideDetails => ({ prerequisites, steps, verification, troubleshooting, readMinutes })

const guideByHref: Record<string, ToolGuideDetails> = {
  "/ai-text-detector": guide(
    [text("准备至少约 300 个字符、最好 150–200 个英文词的连续文本。", "Prepare at least about 300 characters, ideally 150–200 English words of continuous prose."), text("首次运行要下载本地模型，建议保持页面开启并使用稳定网络。", "The first run downloads the local model, so keep the page open on a stable connection.")],
    [step("粘贴英文文本", "Paste English text", "把待检查内容粘贴进输入框，先看字符数和英文词数是否足够。", "Paste the content into the editor and confirm that the character and word counts are high enough."), step("开始本地检测", "Start local detection", "点击“开始本地检测”。首次准备通常需要 30–60 秒，之后会复用浏览器缓存。", "Select Start local detection. First-time setup usually takes 30–60 seconds; later runs reuse the browser cache."), step("阅读风险与稳定度", "Read risk and stability", "同时查看 AI 风险估计、结果稳定度和分析片段数量，不要只看一个百分比。", "Review the AI-risk estimate, result stability, and segment count together instead of relying on one percentage."), step("检查分段证据", "Inspect segment evidence", "展开各段分数和摘录，判断高风险是否集中在模板化或重复段落。", "Inspect each segment score and excerpt to see whether risk is concentrated in templated or repetitive passages."), step("导出报告", "Export the report", "需要保存证据时导出 JSON；报告包含模型、后端、分段结果和限制说明。", "Export JSON when you need a record; it includes the model, backend, segment results, and limitations.")],
    [text("页面显示完整风险卡片和至少一个分析片段。", "The page shows the full risk card and at least one analyzed segment."), text("JSON 报告中的 textLength 与输入字符数一致。", "The JSON report's textLength matches the input character count.")],
    [text("不足 300 个字符时请补充完整段落，短文本不适合评分。", "If the text is under 300 characters, add complete paragraphs; short text is unsuitable for scoring."), text("模型无法启动时刷新页面，并确认浏览器允许 WebGPU/WASM 与模型资源下载。", "If the model cannot start, refresh and confirm that the browser can load WebGPU/WASM and model assets."), text("翻译、专业模板或非英文内容可能误判，结果不能作为作者身份鉴定。", "Translations, professional templates, and non-English text can be misclassified; the result is not proof of authorship.")],
    7,
  ),
  "/ai-image-detector": guide(
    [text("使用 JPEG、PNG 或 WebP，单个文件不超过 25 MB。", "Use a JPEG, PNG, or WebP file no larger than 25 MB."), text("尽量保留原始文件；截图、社交平台重编码会丢失来源元数据。", "Prefer the source file; screenshots and social-media re-encoding can remove provenance metadata.")],
    [step("选择图片", "Choose an image", "上传区域只读取当前设备上的图片，并显示本地预览。", "Choose a local image; the page reads it on-device and shows a local preview."), step("运行来源证据检查", "Run the provenance evidence check", "等待文件来源、可见平台标记和像素模型三个通道分别完成；任何单个通道失败都不会阻断其余结果。", "Wait for file provenance, visible platform marks, and the pixel model to finish independently; one unavailable channel does not block the others."), step("先看可验证证据", "Start with verifiable evidence", "优先阅读 C2PA、EXIF、XMP 与生成器字段；这些是文件内证据，但缺失不代表图片一定来自相机。", "Review C2PA, EXIF, XMP, and generator fields first. These are file-level evidence, but their absence does not prove camera origin."), step("再看视觉线索与统计估计", "Then review visual clues and statistical estimates", "分别查看可见平台标记与像素模型估计，留意通道冲突，不要把模型百分比当成来源事实。", "Review visible platform marks and the pixel-model estimate separately, note conflicts, and do not treat a model percentage as a provenance fact."), step("导出证据报告", "Export the evidence report", "导出 JSON 保存检测器版本、通道可用性、文件证据、区域估计与限制。", "Export JSON to retain the detector version, channel availability, file evidence, regional estimates, and limitations.")],
    [text("结果页分别标明“文件证据”“视觉线索”和“统计估计”，并明确标记不可用通道。", "The result labels file evidence, visual clues, and statistical estimates separately, with unavailable channels clearly identified."), text("文件格式、尺寸和大小与源文件相符，报告包含检测器版本与限制。", "The reported format, dimensions, and file size match the source, and the report includes a detector version and limitations.")],
    [text("像素模型不可用时仍可阅读来源证据，但不要把单通道当作最终判断。", "If the pixel model is unavailable, provenance evidence still works, but do not treat one channel as a final verdict."), text("缺少元数据不能证明图片来自相机，可能只是被截图或重新导出。", "Missing metadata does not prove camera origin; the image may have been captured or re-exported."), text("插画、强压缩图片和新型生成器更容易落入不确定区间。", "Illustrations, heavily compressed images, and new generators are more likely to be uncertain.")],
    8,
  ),
  "/gemini-watermark-remover": guide(
    [text("只处理你有权编辑、带 Gemini、豆包或即梦可见角标的图片。", "Only use images you may edit that contain visible Gemini, Doubao, or Jimeng marks."), text("该工具不处理第三方版权水印或 SynthID 等不可见信号。", "The tool does not target third-party copyright watermarks or invisible signals such as SynthID.")],
    [step("选择图片", "Choose an image", "加载图片后检查预览，确认角标完整可见。", "Load the image and confirm that the visible mark is clearly present in the preview."), step("选择识别方式", "Choose a detection mode", "优先使用自动识别；已知平台时可直接选择 Gemini、豆包或即梦。", "Start with Auto, or select Gemini, Doubao, or Jimeng when the source platform is known."), step("必要时手动框选", "Select manually when needed", "自动识别不确定或图片经过压缩时，切到手动模式，仅框住文字和少量边缘。", "If auto detection is uncertain or the image is compressed, switch to Manual and tightly select the mark plus a small margin."), step("确认权利并处理", "Confirm rights and process", "勾选权利确认后开始本地分析与修复；不确定时工具不会修改原图。", "Confirm your right to edit, then process locally; uncertain detections leave the image unchanged."), step("比较并下载", "Compare and download", "查看识别平台、置信度和预览，确认修复自然后下载 PNG。", "Review the provider, confidence, and preview, then download PNG only if the repair looks natural.")],
    [text("结果卡显示“本地处理完成”，并提供可下载 PNG。", "The result card says Local processing complete and offers a PNG download."), text("放大查看原水印边缘，确认没有明显模糊块或重复纹理。", "Zoom around the original mark and check for blur blocks or repeated texture.")],
    [text("选区过大时缩小到水印本身，周围必须有足够像素用于修复。", "If the selection is too large, tighten it around the mark so nearby pixels can be used for repair."), text("复杂纹理或位置变化时使用手动框选。", "Use manual selection on complex textures or shifted marks."), text("未修改图片表示置信度不足，不要反复扩大选区强行处理。", "Image unchanged means confidence was insufficient; do not keep enlarging the selection to force a result.")],
    7,
  ),
  "/3d-model-converter": guide(
    [text("支持 GLB、glTF、OBJ、FBX、STL 和 PLY；带外部 BIN、MTL 或贴图时请一起选择。", "GLB, glTF, OBJ, FBX, STL, and PLY are supported; select related BIN, MTL, and texture files together."), text("大模型或高分辨率贴图可能超过浏览器可用内存。", "Large models or high-resolution textures may exceed available browser memory.")],
    [step("选择模型及关联文件", "Choose the model and dependencies", "同时选择主模型、BIN、MTL 与贴图，工具会自动寻找关联资源。", "Select the main model, BIN, MTL, and textures together so related resources can be resolved."), step("等待本地解析", "Wait for local parsing", "模型加载后查看场景、网格数量和尺寸信息；原文件不会被修改。", "After loading, inspect the scene, mesh count, and dimensions; the source files remain unchanged."), step("检查预览", "Inspect the preview", "旋转和缩放视图，确认几何方向、比例和缺失资源。", "Rotate and zoom the view to check geometry orientation, scale, and missing resources."), step("选择输出格式", "Choose an output format", "根据用途选择 GLB、OBJ、STL 或 PLY；几何交换格式可能不保留材质、动画或骨骼。", "Choose GLB, OBJ, STL, or PLY for the target workflow; geometry formats may not preserve materials, animation, or rigs."), step("转换并下载", "Convert and download", "点击转换，等待浏览器生成文件后保存到本地。", "Convert locally and save the generated file when the browser finishes.")],
    [text("预览中模型轮廓和朝向符合源文件。", "The preview's silhouette and orientation match the source."), text("在目标 3D 软件中重新打开导出文件，检查单位、法线和材质保留情况。", "Reopen the export in the target 3D app and verify units, normals, and retained materials.")],
    [text("提示缺少资源时重新选择主模型与全部 BIN、MTL、贴图。", "If dependencies are missing, reselect the main model with every BIN, MTL, and texture."), text("内存不足时降低贴图分辨率或简化模型。", "If memory is exhausted, reduce texture resolution or simplify the model."), text("STL/PLY/OBJ 以几何为主，动画、相机、灯光和骨骼丢失属于格式限制。", "STL, PLY, and OBJ are geometry-focused; losing animation, cameras, lights, or rigs is a format limitation.")],
    8,
  ),
  "/remove-background": guide(
    [text("一次可加入最多 30 张 JPG、PNG 或 WebP，单张最大 15 MB；人物、商品、动物等主体使用同一套本地去背景能力。", "Add up to 30 JPG, PNG, or WebP images, each up to 15 MB. People, products, animals, and other subjects use the same on-device removal capability."), text("首次使用约需准备 4.6 MB，可使用 WebGPU 或 WASM CPU；队列始终逐张处理以控制内存。", "The first run prepares about 4.6 MB and can use WebGPU or WASM CPU. The queue always processes one image at a time to limit memory use.")],
    [step("建立批量队列", "Build the batch queue", "一次选择或拖入多张图片，检查每张原图预览、尺寸和文件名。", "Choose or drop multiple images, then check each original preview, dimensions, and filename."), step("开始批量去背景", "Start batch removal", "工具按队列顺序逐张处理；需要时可在当前图片完成后停止。", "The tool processes images in queue order. You can stop after the current image when needed."), step("检查并修正逐项结果", "Review and refine each result", "每个队列项并排显示原图和透明结果；点击某张结果即可使用保留、移除与柔化工具修正边缘。", "Each queue item shows the source and transparent result side by side. Select a result to refine it with Keep, Remove, and edge softness controls."), step("保存修正", "Save refinements", "应用修正后，该队列项的预览、单张下载和 ZIP 会一起更新。", "After applying refinements, that queue item's preview, individual download, and ZIP output are updated."), step("继续批量快速修图", "Continue to batch quick editing", "点击队列底部的继续按钮，将全部成功结果一次带入批量快速修图。", "Use the continue button below the queue to pass every successful result to batch quick editing at once."), step("下载结果", "Download results", "逐张下载透明 PNG，或把全部成功结果打包为 ZIP。", "Download transparent PNG files individually or package all successful results as a ZIP.")],
    [text("成功项的透明结果尺寸与各自原图一致，ZIP 数量与成功项一致。", "Each successful transparent result matches its source dimensions, and the ZIP count matches completed items."), text("队列中应用的补回、擦除和边缘柔化应与最终单张 PNG 和 ZIP 内文件一致。", "Keep, Remove, and edge softness applied in the queue should match both the individual PNG and the file inside the ZIP.")],
    [text("没有 WebGPU 时会自动使用本机 CPU，处理时间可能更长，无需手动切换。", "When WebGPU is unavailable, the tool automatically uses this device's CPU. Processing may take longer, with no manual switching required."), text("本地能力准备失败时检查网络后重试；下载文件会先完成 SHA-256 校验。", "If on-device setup fails, check the connection and retry. The downloaded file is SHA-256 verified."), text("细发丝、玻璃、烟雾、细辐条、低对比边缘和严重遮挡可能仍需保留或移除画笔修正。", "Fine hair, glass, smoke, fine spokes, low-contrast edges, and severe occlusion may still need Keep or Remove brush corrections.")],
    8,
  ),
  "/remove-ai-metadata-from-image": guide(
    [text("准备 JPEG、PNG 或 WebP，并保留仍可能需要的原文件。", "Prepare a JPEG, PNG, or WebP and keep any source file you may still need."), text("只处理你拥有编辑权利的图片。", "Only process images you have the right to edit.")],
    [step("选择图片并检查", "Choose and inspect", "工具会本地列出格式、大小、元数据项和命中的 AI 生成器或工作流信号。", "The tool locally lists format, size, metadata count, and matched generator or workflow signals."), step("阅读处理边界", "Read the processing boundary", "确认将删除的 XMP、IPTC、提示词或软件字段，复杂混合段可能包含其他描述。", "Review the XMP, IPTC, prompt, or software fields to be removed; mixed segments can contain other descriptions."), step("下载备份", "Download a backup", "如需保留原始来源信息，先下载原文件备份。", "Download a source backup first if the original provenance information matters."), step("确认并清理", "Confirm and clean", "勾选权利与来源理解确认，再点击“清理 AI 元数据”。", "Confirm your rights and understanding of provenance, then remove AI metadata."), step("核对并下载", "Verify and download", "只有像素载荷哈希一致时才下载清理结果。", "Download the cleaned file only when the pixel-payload hash matches.")],
    [text("结果显示像素载荷“哈希一致”。", "The result reports a matched pixel-payload hash."), text("复检中的 AI/软件目标信号数量减少或为零。", "The post-check shows fewer or no targeted AI/software signals.")],
    [text("没有命中字段时仍可复检，但不要预期文件大小明显变化。", "If no fields are matched, you can still recheck, but do not expect a meaningful size change."), text("哈希校验失败时不要使用输出，保留原文件。", "Do not use the output if hash verification fails; keep the source."), text("清理元数据不会改变图片的真实创作历史。", "Removing metadata does not change the image's real creation history.")],
    7,
  ),
  "/remove-c2pa-content-credentials": guide(
    [text("准备包含或疑似包含 C2PA/JUMBF 来源凭证的 JPEG、PNG 或 WebP。", "Prepare a JPEG, PNG, or WebP that contains or may contain C2PA/JUMBF provenance credentials."), text("先保留原文件，因为删除来源凭证不可逆。", "Keep the source first because removing provenance credentials is irreversible.")],
    [step("选择并检查文件", "Choose and inspect", "查看 C2PA/JUMBF 目标信号和文件容器信息。", "Review C2PA/JUMBF target signals and the file-container details."), step("保存来源备份", "Save a source backup", "点击下载原文件备份，保留可验证的来源凭证。", "Download a source backup to retain verifiable provenance credentials."), step("确认处理边界", "Confirm the boundary", "理解该操作只删除容器凭证，不删除 SynthID 等像素级不可见水印。", "Understand that this removes container credentials, not pixel-level signals such as SynthID."), step("执行本地清理", "Run local cleanup", "确认权利后点击“清理 C2PA”。", "Confirm your rights and select Remove C2PA."), step("验证像素并下载", "Verify pixels and download", "检查像素载荷哈希一致、复检信号减少后再下载。", "Download only after the pixel hash matches and post-check signals are reduced.")],
    [text("Removed containers 列出 C2PA/JUMBF，或说明未发现匹配容器。", "Removed containers lists C2PA/JUMBF, or states that no matching container was found."), text("Pixel payload 显示 Hash matched。", "Pixel payload reports Hash matched.")],
    [text("未发现 C2PA 可能表示文件从未包含凭证，也可能已被平台重编码。", "No C2PA may mean credentials never existed or were removed by platform re-encoding."), text("像素哈希不一致时停止使用结果。", "Stop and discard the result if the pixel hash differs."), text("删除凭证不能用于宣称图片由真人创作。", "Credential removal cannot support a claim of human authorship.")],
    6,
  ),
  "/remove-made-with-ai-label": guide(
    [text("准备可能含 DigitalSourceType、C2PA AI 声明或 Made with AI 元数据的图片。", "Prepare an image that may contain DigitalSourceType, C2PA AI assertions, or Made with AI metadata."), text("平台也可能使用像素分类器或上传历史，结果不保证移除平台标签。", "Platforms may also use pixel classifiers or upload history, so label removal is not guaranteed.")],
    [step("选择图片", "Choose an image", "等待本地容器检查完成。", "Wait for the local container inspection to finish."), step("核对目标信号", "Review target signals", "查看 DigitalSourceType、Made with AI 或相关 AI 声明是否命中。", "Check whether DigitalSourceType, Made with AI, or related AI assertions are present."), step("保留原文件", "Keep the source", "需要来源记录时先下载备份。", "Download a source backup first when provenance records matter."), step("确认并清理", "Confirm and clean", "确认处理权利和限制后执行“清理 AI 标签信号”。", "Confirm rights and limitations, then remove AI label signals."), step("复检输出", "Recheck the output", "确认目标字段减少且像素载荷哈希一致，再下载结果。", "Confirm the target fields are reduced and the pixel hash matches before downloading.")],
    [text("复检信号不再列出目标 DigitalSourceType 或 AI 声明。", "The post-check no longer lists the targeted DigitalSourceType or AI assertion."), text("图片像素载荷保持一致。", "The image pixel payload remains unchanged.")],
    [text("平台标签仍存在并不代表清理失败，平台可能使用文件外信号。", "A remaining platform label does not necessarily mean cleanup failed; the platform may use external signals."), text("不要用该工具绕过平台规则或误述图片来源。", "Do not use the tool to evade platform rules or misrepresent image origin."), text("像素载荷校验失败时不要下载输出。", "Do not download the output if pixel-payload verification fails.")],
    6,
  ),
  "/image-compressor": guide(
    [text("准备最多 30 张 JPG、PNG 或 WebP；源文件合计建议不超过 250 MB。", "Prepare up to 30 JPG, PNG, or WebP images with no more than 250 MB of source files in total."), text("先决定统一输出格式、最长边、质量，以及 JPG/WebP 是否需要目标 KB。", "Decide on one output format, longest edge, quality, and an optional target KB for JPG or WebP.")],
    [step("加入图片队列", "Build the image queue", "一次选择或拖入多张图片；工具会逐张校验实际文件内容，并显示处理顺序。", "Choose or drop multiple images. The tool validates actual file contents one at a time and shows the processing order."), step("设置统一交付参数", "Set delivery parameters", "选择 JPG、WebP 或 PNG，设置最长边、质量和可选目标 KB。PNG 为无损编码，不使用质量或目标 KB。", "Choose JPG, WebP, or PNG, then set the longest edge, quality, and optional target KB. PNG is lossless and does not use quality or target KB."), step("设置命名规则", "Set a naming rule", "使用 {name}、{index} 和 {ext} 生成统一文件名，并检查预览。", "Use {name}, {index}, and {ext} to generate consistent filenames and check the preview."), step("开始顺序处理", "Process sequentially", "工具按列表逐张解码和编码，单张失败不会中断其余图片；需要时可在当前项后停止。", "The tool decodes and encodes one image at a time. One failure does not stop the rest, and you can stop after the current item."), step("下载结果", "Download results", "逐张检查尺寸与大小后单独下载，或把所有成功结果打包为 ZIP。", "Check dimensions and size, download individual results, or package all successful outputs as a ZIP.")],
    [text("所有成功结果使用同一套参数和不重复的文件名。", "All successful outputs use one set of parameters and unique filenames."), text("ZIP 内文件数量与完成项一致，结果可以正常打开，目标 KB 状态有明确说明。", "The ZIP contains every completed item, outputs reopen correctly, and target-KB status is clearly reported.")],
    [text("照片优先使用 JPG/WebP；需要透明背景时使用 PNG。", "Prefer JPG/WebP for photos and PNG when transparency is required."), text("内存不足时降低最长边、减少单批图片数量或关闭其他占用内存的标签页。", "If memory is low, reduce the longest edge, use a smaller batch, or close memory-heavy tabs."), text("重新编码默认不保留 EXIF、GPS、XMP、IPTC 或 C2PA；需要来源记录时保留原文件。", "Re-encoding does not retain EXIF, GPS, XMP, IPTC, or C2PA by default, so keep the source when provenance matters.")],
    7,
  ),
  "/image-editor": guide(
    [text("一次可加入最多 30 张 JPG、PNG 或 WebP，每张不超过 25 MB、24 MP；编辑时只加载当前选中的图片。", "Queue up to 30 JPG, PNG, or WebP images, each under 25 MB and 24 MP. Only the selected image is loaded into the editor."), text("该工具适合逐张快速裁剪、调色、标注和局部打码，不提供对整批图片同时套用同一编辑动作。", "This tool is for quick per-image cropping, tuning, annotation, and local redaction; it does not apply one edit operation to the entire batch at once.")],
    [step("建立快速修图队列", "Build the quick-edit queue", "一次选择多张图片、粘贴剪贴板图片，或接收上一步的完整批次。", "Choose multiple images, paste an image, or receive the complete batch from the previous tool."), step("点选当前图片", "Select the active image", "点击队列缩略图把该图片加载到编辑器。未保存修改时切换会先确认。", "Select a queue thumbnail to load that image into the editor. Switching with unsaved edits asks for confirmation."), step("完成单张编辑", "Edit one image", "裁剪、旋转、调色、添加文字和图形、绘画或局部打码。", "Crop, rotate, tune, annotate, draw, or redact the active image."), step("保存到队列", "Save to the queue", "选择输出格式和质量，点击“保存到队列”，缩略图会标记为已保存。", "Choose the output format and quality, then select Save to queue. The thumbnail is marked as saved."), step("继续下一张", "Continue to the next image", "从上方队列点选下一张；已保存结果可单独下载。", "Select the next image from the queue. Saved results can be downloaded individually."), step("继续批量优化", "Continue to batch optimization", "确认当前图片没有未保存修改，再把整个队列的最新版本一次带入批量优化。", "Make sure the active image has no unsaved changes, then pass the latest version of the entire queue to batch optimization."), step("下载已编辑结果", "Download edited results", "逐张下载或把全部已保存结果打包为 ZIP。", "Download saved results individually or package them into a ZIP.")],
    [text("队列中已保存标记与实际保存结果一致，重新点选时加载最近一次保存的版本。", "Saved badges match actual queue results, and reselecting an item loads its latest saved version."), text("导出尺寸与裁剪后的画布一致，文字、箭头、画笔和马赛克位置正确。", "Export dimensions match the cropped canvas and text, arrows, brush marks, and mosaic regions appear in the right places."), text("ZIP 只包含已保存到队列的图片。", "The ZIP contains only images saved to the queue.")],
    [text("大图编辑卡顿时先使用图片压缩工具缩小尺寸，或关闭其他占用内存的标签页。", "If a large image is slow, resize it with the image compressor first or close memory-heavy tabs."), text("阿拉伯语文字方向不正确时重新选择文字对象，并确认页面语言和文字对齐方向一致。", "If Arabic text direction looks wrong, reselect the text object and confirm the page language and alignment direction match."), text("重新编码通常会删除 EXIF、GPS 和 C2PA 元数据，需要来源信息时请保留原文件。", "Re-encoding usually removes EXIF, GPS, and C2PA metadata, so retain the source when provenance matters.")],
    6,
  ),
  "/image-wobble-maker": guide(
    [
      text("准备一张主体清晰的 PNG、JPG 或 WebP；透明背景的头像、贴纸与插画通常更容易做出自然效果。", "Prepare a PNG, JPG, or WebP with a clear subject. Avatars, stickers, and illustrations with transparent backgrounds are often easiest to animate naturally."),
      text("先判断哪些区域应保持固定，再只为头发、衣摆、耳朵或装饰等柔软部分添加晃动遮罩。", "Decide which areas should stay fixed, then mask only flexible parts such as hair, fabric, ears, or decorations."),
    ],
    [
      step("选择图片", "Choose an image", "从设备选择图片，或使用页面示例快速了解完整流程。", "Choose an image from your device, or load the sample to explore the complete workflow."),
      step("涂出晃动区域", "Paint the wobble area", "调整画笔大小与柔和度，在需要运动的位置涂抹；误涂时切换橡皮擦或使用撤销。", "Adjust brush size and softness, then paint the areas that should move. Switch to Erase or use Undo to fix mistakes."),
      step("预览并选择手感", "Preview and tune the motion", "切换到预览，选择柔和、弹性、伸展等预设，再调整强度、速度、伸展与回弹。", "Open Preview, choose a soft, bouncy, or stretchy preset, then tune strength, speed, stretch, and bounce."),
      step("选择运动方式", "Choose a motion style", "使用摇摆、弹跳或绕圈自动播放；支持的移动设备还可用动作传感器控制。", "Use automatic Sway, Hop, or Orbit motion. Supported mobile devices can also control motion with the device sensor."),
      step("生成并下载", "Create and download", "选择 GIF、WebM 或可用的 MP4，设置时长和尺寸，在本地生成后检查预览并下载。", "Choose GIF, WebM, or an available MP4 option, set duration and size, then create locally, review, and download."),
    ],
    [
      text("预览中未涂抹区域保持稳定，遮罩边缘没有明显断层或拉裂。", "Unpainted areas stay stable in preview, with no obvious seams or tearing around mask edges."),
      text("导出的动画尺寸、时长和运动方向与预览基本一致，并能在常用查看器中正常循环播放。", "The exported animation broadly matches the preview's dimensions, duration, and motion and loops correctly in common viewers."),
    ],
    [
      text("主体被整体拉动时撤销遮罩，只保留柔软部位，并降低画笔强度或晃动强度。", "If the whole subject shifts, undo part of the mask, keep only flexible areas, and reduce brush or motion strength."),
      text("GIF 生成缓慢时缩短时长或选择 640 px；更高分辨率优先使用 WebM。", "If GIF creation is slow, shorten the duration or use 640 px. Prefer WebM for higher resolutions."),
      text("MP4 不可选表示浏览器没有相应编码器，请改用 WebM 或 GIF。", "A disabled MP4 option means the browser lacks that encoder; use WebM or GIF instead."),
    ],
    6,
  ),
  "/resize-image-to-kb": guide(
    [text("使用 JPG 或 WebP；PNG 无法稳定按质量搜索目标大小。", "Use JPG or WebP; PNG cannot reliably target a byte size through quality search."), text("目标范围为 10–10,000 KB。", "Target size can be set from 10 to 10,000 KB.")],
    [step("选择图片", "Choose an image", "加载图片并选择 JPG 或 WebP 输出。", "Load the image and choose JPG or WebP output."), step("输入目标 KB", "Enter the target KB", "填写文件大小上限；工具会优先确保结果不超过目标。", "Enter the file-size ceiling; staying under it takes priority."), step("设置最长边和可选调整", "Set dimensions and optional edits", "如有需要设置最长边、裁切、旋转或调色。", "Optionally set longest edge, crop, rotation, or color adjustments."), step("运行目标压缩", "Run target compression", "工具先搜索编码质量，必要时安全缩小尺寸。", "The tool searches encoding quality first, then safely reduces dimensions if needed."), step("检查是否命中", "Check target status", "比较结果大小与目标；若无法精确命中，会给出安全范围内最接近的结果。", "Compare output size with the target; if exact targeting is impossible, the closest safe result is returned.")],
    [text("结果大小不超过目标，或页面明确提示“未完全达到目标”。", "The output is under the target, or the page explicitly reports Target not fully reached."), text("尺寸与画质仍满足上传或提交要求。", "Dimensions and visual quality still meet the destination's requirements.")],
    [text("目标过小时提高目标 KB，或接受更小尺寸。", "If the target is too small, raise the KB limit or accept smaller dimensions."), text("PNG 请返回普通图片压缩工具调整尺寸。", "Use the standard image compressor for PNG resizing."), text("文字截图出现模糊时优先增加目标大小，而不是继续降低质量。", "For blurry text screenshots, increase the target size instead of lowering quality further.")],
    6,
  ),
  "/color-tools": guide(
    [text("准备前景色和背景色的 HEX 值，或一张用于提取调色板的图片。", "Prepare foreground and background HEX values, or an image for palette extraction."), text("屏幕取色需要浏览器支持 EyeDropper API。", "Screen color picking requires browser EyeDropper API support.")],
    [step("输入两种颜色", "Enter two colors", "用颜色输入框、HEX 文本或屏幕取色器设置前景与背景。", "Set foreground and background using color inputs, HEX text, or the screen picker."), step("读取颜色格式", "Read color formats", "复制自动生成的 HEX、RGB 和 HSL 值。", "Copy the generated HEX, RGB, and HSL values."), step("检查可访问性", "Check accessibility", "查看 WCAG 对比度以及 AA/AAA 普通文本和大号文本状态。", "Review WCAG contrast and AA/AAA status for normal and large text."), step("提取图片调色板", "Extract an image palette", "选择 PNG、JPG 或 WebP，工具会生成最多 8 个主要颜色。", "Choose a PNG, JPG, or WebP to generate up to eight dominant colors."), step("复制颜色", "Copy colors", "点击调色板色块即可复制 HEX。", "Select a palette swatch to copy its HEX value.")],
    [text("普通正文至少达到 AA 4.5:1，或根据设计要求达到 AAA 7:1。", "Normal body text reaches at least AA 4.5:1, or AAA 7:1 when required."), text("复制的颜色值与预览色块一致。", "Copied color values match the preview swatches.")],
    [text("浏览器不支持屏幕取色时直接输入 HEX。", "If screen picking is unsupported, enter HEX values directly."), text("提取失败时换用 PNG、JPG 或 WebP。", "If extraction fails, use PNG, JPG, or WebP."), text("调色板是量化后的主要颜色，不代表每个原始像素值。", "The palette contains quantized dominant colors, not every original pixel value.")],
    5,
  ),
  "/svg-tools": guide(
    [text("使用 2 MB 以内的 SVG 文件，或直接粘贴 SVG 源码。", "Use an SVG under 2 MB or paste SVG source directly."), text("预览会移除脚本、外部链接与 foreignObject。", "The preview removes scripts, external links, and foreignObject.")],
    [step("打开或粘贴 SVG", "Open or paste SVG", "选择本地 SVG，或在左侧编辑源码。", "Open a local SVG or edit the source in the left pane."), step("检查安全预览", "Inspect the safe preview", "确认右侧能正常渲染，并查看 viewBox、宽高与比例。", "Confirm the right pane renders correctly and review viewBox, dimensions, and ratio."), step("格式化或压缩", "Format or minify", "按需要整理缩进，或移除注释和多余空白。", "Format indentation for readability or remove comments and extra whitespace."), step("下载安全 SVG", "Download safe SVG", "保存经过清理、可正常预览的 SVG。", "Save the sanitized SVG that rendered successfully."), step("导出 PNG", "Export PNG", "输入 16–4096 的输出宽度，按原比例生成 PNG。", "Enter a width from 16 to 4096 and export a proportional PNG.")],
    [text("安全预览没有脚本、外部资源或解析错误。", "The safe preview has no scripts, external resources, or parser errors."), text("PNG 高度按 viewBox 比例自动计算且画面未变形。", "PNG height follows the viewBox ratio without distortion.")],
    [text("无 viewBox 或有效宽高时补充尺寸信息。", "Add a viewBox or valid width and height if dimensions cannot be determined."), text("PNG 导出失败时移除外部字体、图片和链接。", "If PNG export fails, remove external fonts, images, and links."), text("压缩源码后如需继续编辑，先保留可读版本。", "Keep a readable copy before minifying if more editing is expected.")],
    6,
  ),
  "/avatar-emoji-generator": guide(
    [text("可使用 1–3 个字符，或一张浏览器可读取的本地图片。", "Use one to three characters or a browser-readable local image."), text("输出为静态 PNG，不生成动画表情。", "Output is a static PNG, not an animated emoji.")],
    [step("选择文字或图片模式", "Choose text or image mode", "文字适合姓名缩写，图片适合头像和团队 Logo。", "Use text for initials and image mode for portraits or team logos."), step("设置外观", "Set appearance", "调整文字色、背景色、方形/圆形/圆角形状和内边距。", "Adjust text color, background, square/circle/rounded shape, and padding."), step("检查画布预览", "Inspect the canvas preview", "确认主体居中，圆形模式下重要内容没有被裁切。", "Confirm the subject is centered and important content is not cropped in circle mode."), step("选择尺寸", "Choose a size", "根据聊天表情或高清头像需求选择 128 或 512 像素。", "Choose 128 px for chat emoji or 512 px for a higher-resolution avatar."), step("下载 PNG", "Download PNG", "保存结果并在目标平台上传测试。", "Download PNG and test it on the destination platform.")],
    [text("输出为正方形 PNG，透明/背景与预览一致。", "The output is a square PNG whose transparency/background matches the preview."), text("在小尺寸预览中缩写或主体仍清晰可辨。", "Initials or the subject remain recognizable at small size.")],
    [text("圆形裁切切到脸部或 Logo 时增加内边距。", "Increase padding if circular cropping cuts into a face or logo."), text("图片无法加载时换用 PNG、JPG 或 WebP。", "If the image cannot load, use PNG, JPG, or WebP."), text("平台再次裁切头像时，使用更大的安全边距。", "Use more safe padding when the platform applies another crop.")],
    5,
  ),
  "/pdf-tools": guide(
    [text("单个 PDF 最大 150 MB，工作台合计最大 300 MB；加密或损坏文件可能无法读取。", "Each PDF can be up to 150 MB and the workspace up to 300 MB; encrypted or damaged files may not open."), text("工作台最多加入 20 个 PDF、合计 1000 页；图片转 PDF 支持 JPG 和 PNG。", "The workspace supports up to 20 PDFs and 1,000 pages; Images-to-PDF supports JPG and PNG.")],
    [step("添加来源 PDF", "Add source PDFs", "选择或拖入一个或多个 PDF；文件会逐个在后台读取并按来源颜色标记。", "Choose or drop one or more PDFs. Files are read one at a time in the background and marked by source color."), step("选择并整理页面", "Select and organize pages", "单击选择一页，使用 Ctrl/Cmd 多选或 Shift 连续选择；拖动页面调整顺序，也可批量旋转或删除。", "Select one page, use Ctrl/Cmd for multiple pages or Shift for a range, then drag to reorder or batch-rotate and remove pages."), step("撤销或管理来源", "Undo or manage sources", "使用撤销、重做和恢复原始顺序；也可整体移动、隐藏或移除来源 PDF。", "Use undo, redo, and reset order, or move, hide, and remove an entire source PDF."), step("设置导出标记", "Configure export marks", "按需添加底部页码和文字水印，并查看来源数、保留页数与删除页数。", "Optionally add bottom page numbers and a text watermark, then review source, kept-page, and removed-page counts."), step("导出并复核", "Export and verify", "导出完整工作台或仅提取所选页面；可随时取消后台导出，完成后重新打开核对。", "Export the complete workspace or selected pages only. You can cancel the background export and reopen the result to verify it.")],
    [text("打开输出并核对页数、顺序、旋转方向、页码和文字水印。", "Open the output and verify page count, order, rotation, page numbers, and text watermark."), text("原 PDF 保持不变；PDF 转图片 ZIP 中的 page-N.png 与所选页码一致。", "The source PDF remains unchanged, and page-N.png files in a PDF-to-images ZIP match the selected range.")],
    [text("工作台至少要保留一页；尝试删除全部页面时会停止操作。", "The workspace must retain at least one page; removing every page is blocked."), text("加密 PDF 需要先在有权限的软件中解锁。", "Encrypted PDFs must be unlocked first in authorized software."), text("超大 PDF 处理慢或内存不足时拆成较小批次；缩略图只在可见时生成，不影响全部页面导出。", "Split very large PDFs into smaller batches if processing is slow or memory-limited. Thumbnails are generated only when visible and do not limit full export.")],
    7,
  ),
  "/favicon-generator": guide(
    [text("准备 PNG、JPG、WebP 或 SVG Logo，最好为正方形并留有安全边距。", "Prepare a PNG, JPG, WebP, or SVG logo, ideally square with safe padding."), text("输出 ZIP 包含 ICO、多尺寸 PNG、Apple Touch Icon、Manifest 和 HTML 片段。", "The ZIP includes ICO, multiple PNG sizes, Apple Touch Icon, a manifest, and an HTML snippet.")],
    [step("选择源图标", "Choose a source icon", "加载 Logo，并在 32、64、128 像素预览中检查可读性。", "Load the logo and inspect legibility at 32, 64, and 128 pixels."), step("设置背景", "Set the background", "选择与品牌和浏览器主题匹配的背景色。", "Choose a background color that works with the brand and browser themes."), step("调整安全边距", "Adjust safe padding", "将重要内容收在中心，避免小尺寸被裁切。", "Keep important content centered so small icons are not clipped."), step("设置圆角", "Set corner radius", "根据平台风格调整 0–50% 圆角。", "Adjust corner radius from 0–50% for the desired platform style."), step("生成 ZIP", "Generate the ZIP", "下载图标包，并将 HTML 片段与 manifest 路径接入站点。", "Download the icon pack and integrate the HTML snippet and manifest paths.")],
    [text("ZIP 中存在 favicon.ico、apple-touch-icon.png、icon-192.png、icon-512.png。", "The ZIP contains favicon.ico, apple-touch-icon.png, icon-192.png, and icon-512.png."), text("在浏览器标签页和手机主屏测试最小图标仍可识别。", "Test that the smallest icon remains recognizable in browser tabs and on a phone home screen.")],
    [text("Logo 太细或文字太多时简化图形。", "Simplify the mark if the logo is too detailed or text-heavy."), text("边缘被切掉时增加安全边距。", "Increase safe padding if edges are clipped."), text("部署后图标未更新时清理浏览器缓存并检查 HTML 路径。", "If deployed icons do not update, clear browser cache and verify HTML paths.")],
    6,
  ),
  "/spreadsheet-converter": guide(
    [text("支持 XLSX、XLS、CSV 和 TSV，单个文件最大 50 MB。", "XLSX, XLS, CSV, and TSV are supported up to 50 MB."), text("页面只预览前 50 行和前 20 列，导出仍使用完整工作表。", "The page previews only the first 50 rows and 20 columns; export still uses the full sheet.")],
    [step("选择表格", "Choose a spreadsheet", "加载 XLSX、XLS、CSV 或 TSV。", "Load an XLSX, XLS, CSV, or TSV file."), step("选择工作表", "Choose a sheet", "多工作表文件可从下拉框切换当前工作表。", "For multi-sheet workbooks, switch the active sheet from the dropdown."), step("检查预览", "Inspect the preview", "核对表头、日期、分隔符和首批数据行。", "Check headers, dates, delimiters, and the first data rows."), step("选择导出格式", "Choose an export format", "导出当前工作表为 CSV 或 JSON，或保存完整工作簿为 XLSX。", "Export the active sheet as CSV or JSON, or save the full workbook as XLSX."), step("打开结果复核", "Reopen and verify", "在目标软件重新打开文件，检查日期、公式结果和编码。", "Reopen the file in the target app and verify dates, formula results, and encoding.")],
    [text("预览中的表头与源文件一致。", "Preview headers match the source."), text("导出的 CSV/JSON 行数与当前工作表数据量一致。", "Exported CSV/JSON row count matches the active sheet's data.")],
    [text("CSV 列错位时确认源文件使用逗号、制表符或正确引用。", "If CSV columns shift, confirm delimiters and quoted cells in the source."), text("公式可能以计算结果导出，不能替代完整电子表格编辑器。", "Formulas may export as calculated values; this is not a full spreadsheet editor."), text("超出 50 MB 时先在桌面软件拆分工作簿。", "Split workbooks over 50 MB in a desktop spreadsheet app first.")],
    6,
  ),
  "/file-hash-base64": guide(
    [text("可为任意本地文件计算 SHA-256、SHA-1 和 MD5。", "Any local file can be hashed with SHA-256, SHA-1, and MD5."), text("文件转 Base64 限制为 50 MB，避免浏览器内存过高。", "File-to-Base64 is limited to 50 MB to protect browser memory.")],
    [step("选择文件", "Choose a file", "加载后页面显示文件名和大小。", "Load a file and confirm its name and size."), step("计算校验值", "Calculate checksums", "点击计算，等待 SHA-256、SHA-1 和 MD5 完成。", "Calculate and wait for SHA-256, SHA-1, and MD5."), step("复制并对比", "Copy and compare", "优先用 SHA-256 与发布方提供的值逐字符对比。", "Prefer SHA-256 and compare every character with the publisher-provided value."), step("转换 Base64", "Convert to Base64", "需要嵌入时把文件转为 Data URL，并复制结果。", "For embedding, convert the file to a Data URL and copy it."), step("还原文件", "Decode a file", "粘贴 Data URL 或纯 Base64，点击还原并下载。", "Paste a Data URL or raw Base64, then decode and download the file.")],
    [text("SHA-256 完全一致才表示字节内容一致。", "An exact SHA-256 match means the byte content is identical."), text("Base64 还原文件再次计算 SHA-256，应与源文件一致。", "Hashing a Base64-decoded file should reproduce the source SHA-256.")],
    [text("MD5 和 SHA-1 只适合兼容校验，不用于安全完整性判断。", "Use MD5 and SHA-1 only for compatibility, not security-sensitive integrity checks."), text("Base64 无效时移除多余空白并确认没有截断。", "For invalid Base64, remove extra whitespace and confirm the value is not truncated."), text("超过 50 MB 时不要在浏览器中转 Base64。", "Do not Base64-encode files over 50 MB in the browser.")],
    6,
  ),
  "/text-tools": guide(
    [text("准备要统计、清理、编码或比较的纯文本。", "Prepare plain text to count, clean, encode, or compare."), text("编解码操作会替换结果区内容，重要文本请先保留副本。", "Codec operations replace the result area, so keep a copy of important text.")],
    [step("选择工作模式", "Choose a mode", "在统计、清理与排序、编解码、文本对比之间切换。", "Switch among Statistics, Clean and sort, Encode and decode, and Text diff."), step("输入文本", "Enter text", "粘贴内容；统计模式会立即显示字符、词、行、段落和阅读时间。", "Paste content; Statistics immediately shows characters, words, lines, paragraphs, and reading time."), step("执行转换", "Run a transform", "按行去重、排序、修剪、删空行、大小写或全半角转换，或运行 URL/Base64/HTML/Unicode/Hex 编解码。", "Dedupe, sort, trim, remove empty lines, change case/width, or run URL/Base64/HTML/Unicode/Hex codecs."), step("比较版本", "Compare versions", "文本对比模式粘贴两个版本，逐行查看新增和删除。", "In Text diff, paste two versions and review line-by-line additions and removals."), step("复制或下载", "Copy or download", "检查结果后复制，或下载为 TXT。", "Review the result, then copy it or download TXT.")],
    [text("统计值与可见文本结构一致。", "Counts match the visible text structure."), text("转换后抽查首尾行，确认空行、顺序和编码符合预期。", "Spot-check first and last lines after transforming for expected spacing, order, and encoding.")],
    [text("Base64/URL 解码失败时确认输入完整且没有多余字符。", "If Base64 or URL decoding fails, confirm the input is complete and has no extra characters."), text("逐行差异是位置型比较，行移动可能显示为删除加新增。", "Line diff is positional, so moved lines may appear as a deletion plus an addition."), text("去重前如果需要保留原顺序和重复次数，请先复制原文。", "Copy the source before deduping if original order and repetition counts matter.")],
    7,
  ),
  "/json-tools": guide(
    [text("准备 JSON 文本，或需要转为 JSON 的简单 CSV。", "Prepare JSON text or a simple CSV to convert to JSON."), text("JSON 转 CSV 需要顶层为对象数组。", "JSON-to-CSV requires a top-level array of objects.")],
    [step("粘贴内容", "Paste content", "输入 JSON 后先查看“JSON 语法有效”或错误位置。", "Paste JSON and first check for Valid JSON syntax or a line/column error."), step("格式化或压缩", "Format or minify", "格式化用于阅读，压缩用于传输或嵌入。", "Format for readability or minify for transport and embedding."), step("查询路径", "Query a path", "输入如 $.items[0].name 的路径并运行 JSONPath。", "Enter a path such as $.items[0].name and run JSONPath."), step("转换 CSV", "Convert CSV", "对象数组可转 CSV；CSV 也可转成 JSON 对象数组。", "Convert arrays of objects to CSV, or CSV to a JSON object array."), step("复制或下载", "Copy or download", "复核结果后保存 JSON 或 CSV。", "Review and save the result as JSON or CSV.")],
    [text("树形浏览能展开目标字段，查询路径返回预期值。", "Tree view exposes the target field and the query returns the expected value."), text("重新解析输出没有语法错误。", "Re-parsing the output produces no syntax error.")],
    [text("Path not found 时从 $ 开始逐层核对键名和数组索引。", "For Path not found, verify each key and array index from $."), text("JSON 转 CSV 报错时把顶层结构改为对象数组。", "If JSON-to-CSV fails, use an array of objects at the top level."), text("复杂嵌套对象导出 CSV 会变成字符串，必要时先扁平化。", "Nested objects stringify in CSV; flatten them first when needed.")],
    6,
  ),
  "/markdown-editor": guide(
    [text("准备 Markdown 文本；预览支持 GFM 与换行。", "Prepare Markdown text; preview supports GFM and line breaks."), text("生成的 HTML 会在显示前进行清理。", "Generated HTML is sanitized before display.")],
    [step("输入 Markdown", "Write Markdown", "在左侧编辑标题、列表、链接、引用和代码块。", "Edit headings, lists, links, quotes, and code blocks in the left pane."), step("检查实时预览", "Check live preview", "右侧会自动渲染并清理 HTML。", "The right pane automatically renders and sanitizes HTML."), step("修正结构", "Refine structure", "检查标题层级、列表缩进、链接和代码块是否正确。", "Check heading hierarchy, list indentation, links, and code blocks."), step("复制需要的格式", "Copy the needed format", "可复制 Markdown 源文或清理后的 HTML。", "Copy either the Markdown source or sanitized HTML."), step("下载文件", "Download a file", "导出 .md，或下载包含 HTML 文档外壳的 .html。", "Export .md or download .html with a basic document wrapper.")],
    [text("预览中的标题、列表、链接和代码块与源文一致。", "Headings, lists, links, and code blocks in preview match the source."), text("下载的 HTML 在新标签页打开后仍可阅读。", "The downloaded HTML remains readable when opened in a new tab.")],
    [text("预览与预期不同先检查空行和缩进。", "If preview differs, check blank lines and indentation first."), text("被移除的 HTML 通常是不安全标签或属性。", "Removed HTML is usually an unsafe tag or attribute."), text("外观样式不随 HTML 导出完整复制，发布时需配套 CSS。", "The preview styling is not fully embedded in exports; add CSS when publishing.")],
    5,
  ),
  "/qr-code-tool": guide(
    [text("准备网址、文本、Wi‑Fi、邮箱或电话号码内容。", "Prepare a URL, text, Wi-Fi network, email address, or phone number."), text("加入中心 Logo 时建议使用 H 容错并实际扫码测试。", "When adding a center logo, use H error correction and test with a real scanner.")],
    [step("选择内容类型", "Choose content type", "选择 URL、文本、Wi‑Fi、Email 或电话，并填写对应内容。", "Choose URL, Text, Wi-Fi, Email, or Phone and enter the matching value."), step("调整样式", "Adjust style", "设置前景、背景、容错等级和 0–10 的边距。", "Set foreground, background, error-correction level, and margin from 0–10."), step("可选添加 Logo", "Optionally add a logo", "选择 PNG、JPG 或 WebP Logo；Logo 会放在中心。", "Choose a PNG, JPG, or WebP logo to place at the center."), step("生成并测试", "Generate and test", "生成预览，用另一台设备或扫码应用验证。", "Generate the preview and scan it with another device or app."), step("下载 PNG 或 SVG", "Download PNG or SVG", "PNG 适合直接使用，SVG 适合继续排版和缩放。", "Use PNG directly or SVG for further layout and scaling.")],
    [text("扫码结果与输入内容完全一致。", "The scanned value exactly matches the input."), text("在计划使用的打印尺寸和屏幕尺寸都能识别。", "The code scans at both intended print and screen sizes.")],
    [text("带 Logo 扫不出时提高到 H 容错、缩小 Logo 或增加边距。", "If a logo QR fails, use H correction, shrink the logo, or increase margin."), text("前景和背景对比不足时改为深色前景、浅色背景。", "Use a dark foreground and light background when contrast is too low."), text("识别图片失败时提供更清晰、没有透视变形的二维码。", "For decode failures, use a clearer QR image without perspective distortion.")],
    6,
  ),
  "/password-uuid-generator": guide(
    [text("密码长度支持 8–128；UUID 一次可生成 1–50 个。", "Password length ranges from 8–128; generate 1–50 UUIDs at a time."), text("生成依赖浏览器 Web Crypto，结果只显示在当前页面。", "Generation uses browser Web Crypto and results stay on the current page.")],
    [step("设置密码长度", "Set password length", "根据账户要求选择长度，通常优先增加长度。", "Choose a length based on account requirements, generally favoring longer passwords."), step("选择字符集", "Choose character sets", "勾选大小写、数字和符号，并决定是否排除 I/l/1/O/0 等易混淆字符。", "Enable lowercase, uppercase, numbers, and symbols, and decide whether to exclude ambiguous characters."), step("生成并查看熵", "Generate and review entropy", "生成后查看估算熵；它只用于相对强度参考。", "Generate and review estimated entropy as a relative strength indicator only."), step("复制密码", "Copy the password", "立即保存到可信密码管理器，不要通过不安全渠道发送。", "Copy it into a trusted password manager and avoid insecure sharing channels."), step("批量生成 UUID", "Generate UUIDs", "输入 1–50 的数量，生成 UUID v4 并复制全部。", "Enter a quantity from 1–50, generate UUID v4 values, and copy all.")],
    [text("密码至少包含每种已启用字符集中的一个字符。", "The password contains at least one character from every enabled set."), text("每个 UUID 符合 xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx 结构且不重复。", "Every UUID follows the v4 structure and is unique within the batch.")],
    [text("没有选择字符类型时至少启用一组。", "Enable at least one character set if generation is blocked."), text("某些网站不接受特定符号时关闭符号或按规则重新生成。", "If a site rejects some symbols, disable symbols or regenerate to its rules."), text("不要把网页上的熵估算当作账户安全保证。", "Do not treat the page's entropy estimate as an account-security guarantee.")],
    5,
  ),
  "/date-time-tools": guide(
    [text("时间输入可为秒/毫秒时间戳或 ISO 日期。", "Time input can be a seconds/milliseconds timestamp or an ISO date."), text("时区结果依赖浏览器 Intl 数据。", "Time-zone output depends on the browser's Intl data.")],
    [step("输入时间", "Enter a time", "粘贴时间戳、ISO 时间，或点击使用当前时间。", "Paste a timestamp or ISO date, or select Use current time."), step("选择显示时区", "Choose a display zone", "从 UTC、亚洲、欧洲、美洲和澳洲常用时区中选择。", "Choose from common UTC, Asian, European, American, and Australian zones."), step("复制标准结果", "Copy normalized results", "核对本地时间、UTC/ISO 和秒/毫秒时间戳后复制。", "Verify local time, UTC/ISO, and second/millisecond timestamps before copying."), step("计算日期间隔", "Calculate a date interval", "输入开始和结束日期，查看相差天数。", "Enter start and end dates to calculate the interval."), step("计算精确年龄", "Calculate exact age", "输入出生日期和截至日期，查看年、月、日年龄。", "Enter birth and as-of dates to get years, months, and days.")],
    [text("同一时刻转换到不同时区后，UTC 值保持一致。", "UTC remains identical when the same instant is displayed in different zones."), text("日期间隔和年龄方向符合开始/结束顺序。", "Date interval and age direction match the chosen start/end order.")],
    [text("无法识别时确认 10 位秒、13 位毫秒或有效 ISO 格式。", "For unrecognized input, use a 10-digit seconds timestamp, 13-digit milliseconds timestamp, or valid ISO date."), text("夏令时附近不要手工加减小时，应使用目标时区转换。", "Around daylight-saving transitions, use the target time zone instead of manually adding hours."), text("精确年龄需要有效出生日期且截至日期不能更早。", "Exact age requires a valid birth date and an as-of date that is not earlier.")],
    6,
  ),
  "/unit-ratio-converter": guide(
    [text("支持长度、重量、温度、面积、体积、速度和数据大小等常用单位。", "Supports common length, weight, temperature, area, volume, speed, and data-size units."), text("宽高比计算需要宽度和高度都大于 0。", "Aspect-ratio calculations require positive width and height.")],
    [step("选择单位类别", "Choose a unit category", "切换到需要的长度、温度、数据大小等类别。", "Choose the needed category such as length, temperature, or data size."), step("输入数值与单位", "Enter value and units", "填写数值，选择 From 和 To；可用交换按钮反转。", "Enter a value, choose From and To, and use Swap to reverse them."), step("复制结果", "Copy the result", "确认单位后复制完整数值。", "Confirm the units and copy the full value."), step("输入原始尺寸", "Enter source dimensions", "在宽高比区域填写原始宽度、高度和目标宽度。", "In Aspect ratio, enter original width, height, and target width."), step("读取等比尺寸", "Read proportional dimensions", "查看最简比例、小数比例和自动计算的目标高度。", "Read the simplified ratio, decimal ratio, and calculated target height.")],
    [text("交换 From/To 后再转换，可近似回到原值。", "Converting back after swapping From/To approximately returns the source value."), text("目标尺寸的宽高比与原始尺寸一致。", "Target dimensions preserve the source aspect ratio.")],
    [text("温度不是简单倍数转换，务必选择正确类别。", "Temperature is not a simple scale factor; use the correct category."), text("KB/MB 使用十进制，KiB/MiB 使用 1024 进制，不要混用。", "KB/MB are decimal while KiB/MiB use base 1024; do not mix them."), text("出现无效比例时检查所有尺寸是否大于 0。", "For an invalid ratio, confirm every dimension is greater than zero.")],
    5,
  ),
  "/regex-url-tools": guide(
    [text("正则模式最长 500 字符，测试文本最长 100,000 字符。", "Regex patterns are limited to 500 characters and test text to 100,000 characters."), text("正则在独立 Worker 中运行，超过 500 ms 会终止。", "Regex runs in a Worker and stops after 500 ms.")],
    [step("输入正则与标志", "Enter pattern and flags", "填写表达式和 g、i、m、u 等标志。", "Enter the pattern and flags such as g, i, m, or u."), step("添加测试与替换文本", "Add test and replacement text", "粘贴样本，并填写可选的替换内容。", "Paste sample text and provide an optional replacement."), step("运行并查看匹配", "Run and inspect matches", "查看最多 200 个匹配、位置、捕获组和替换结果。", "Review up to 200 matches, positions, capture groups, and replacement output."), step("使用 URL 编解码", "Encode or decode URLs", "根据是组件还是完整 URI 选择 encodeURIComponent/decodeURIComponent 或 encodeURI/decodeURI。", "Choose component encoding/decoding or full-URI encoding/decoding as appropriate."), step("解析完整 URL", "Parse a full URL", "输入带协议和域名的 URL，查看 origin、path、hash 与查询参数。", "Enter a full URL with scheme and host to inspect origin, path, hash, and query parameters.")],
    [text("匹配位置和捕获组与预期样本一致。", "Match positions and capture groups match the sample expectation."), text("URL 编码后再解码能还原原文。", "Decoding an encoded URL value reproduces the source.")],
    [text("运行超时说明表达式可能灾难性回溯，缩小重复量词或重写模式。", "A timeout may indicate catastrophic backtracking; reduce nested repetition or rewrite the pattern."), text("URL 解码报错时检查百分号后是否为两位十六进制。", "For URL decode errors, ensure every percent sign is followed by two hex digits."), text("解析 URL 必须包含 https:// 等协议。", "URL parsing requires a scheme such as https://.")],
    7,
  ),
  "/random-picker": guide(
    [text("准备每行一个候选项的名单。", "Prepare a list with one candidate per line."), text("随机过程使用浏览器加密随机数，不会上传名单。", "Selection uses browser cryptographic randomness and does not upload the list.")],
    [step("粘贴候选项", "Paste candidates", "每行输入一个名称或选项，空行会被忽略。", "Enter one name or option per line; blank lines are ignored."), step("处理重复项", "Handle duplicates", "如果同名只应出现一次，启用“忽略重复项”。", "Enable Ignore duplicate entries when each name should count once."), step("选择模式", "Choose a mode", "抽取 1 项、抽取多项，或输入分组数量进行随机分组。", "Pick one, pick several, or enter a group count for random grouping."), step("运行选择", "Run selection", "点击开始，查看当前结果。", "Start selection and inspect the current result."), step("复制或保留记录", "Copy or review history", "复制结果；本页面历史可帮助核对本次连续操作。", "Copy the result and use this-page history to review the current session.")],
    [text("抽取数量不超过有效候选项。", "The number selected does not exceed valid candidates."), text("分组人数差异最多为一人。", "Group sizes differ by no more than one person.")],
    [text("没有候选项时检查是否全为空行。", "If no candidates appear, check whether every line is blank."), text("重复姓名代表同一人时启用去重，否则会提高其中奖概率。", "Enable dedupe when repeated names represent the same person; otherwise their odds increase."), text("刷新页面会清除本次页面记录，需要留档时先复制。", "Refreshing clears this-page history, so copy results before leaving.")],
    5,
  ),
  "/timer-tools": guide(
    [text("可使用倒计时、番茄钟或秒表；完成记录保存在当前浏览器。", "Use Countdown, Pomodoro, or Stopwatch; completion history stays in this browser."), text("浏览器通知和提示音可能需要用户授权。", "Browser notifications and sounds may require permission.")],
    [step("选择模式", "Choose a mode", "倒计时适合固定时长，番茄钟适合工作/休息循环，秒表适合累计时间。", "Use Countdown for a fixed duration, Pomodoro for work/break cycles, or Stopwatch for elapsed time."), step("设置时长", "Set duration", "输入倒计时时间，或配置番茄钟工作与休息分钟数。", "Set a countdown duration or configure Pomodoro work and break minutes."), step("开始与暂停", "Start and pause", "启动后可暂停、继续或重置。", "Start, then pause, resume, or reset as needed."), step("保持标签页可用", "Keep the tab available", "浏览器后台节流时页面会根据真实时间校正，不要强制关闭标签页。", "The page corrects for background throttling using real time; do not force-close the tab."), step("查看完成记录", "Review completion history", "完成后检查当前浏览器保存的记录。", "After finishing, review the locally stored completion history.")],
    [text("暂停再继续后剩余时间没有明显跳变。", "Remaining time does not jump unexpectedly after pause/resume."), text("完成事件出现在本地历史中。", "The completion appears in local history.")],
    [text("没有声音或通知时检查浏览器站点权限。", "If sound or notifications are missing, check browser site permissions."), text("系统休眠后时间会按真实经过时间校正。", "After system sleep, time is corrected to actual elapsed time."), text("清除浏览器存储会删除完成记录。", "Clearing browser storage removes completion history.")],
    5,
  ),
  "/gif-tools": guide(
    [text("拆帧支持最多 300 帧的 GIF；合成最多使用 100 张 PNG/JPG/WebP。", "Extraction supports GIFs up to 300 frames; creation supports up to 100 PNG/JPG/WebP images."), text("合成图片按选择顺序作为帧顺序。", "Selected image order becomes frame order.")],
    [step("选择拆帧或合成", "Choose extract or create", "拆帧选择一个 GIF；合成选择至少两张图片。", "Choose one GIF to extract, or at least two images to create an animation."), step("拆分 GIF", "Extract a GIF", "点击导出 PNG 帧 ZIP，等待全部帧编码完成。", "Export PNG frames as ZIP and wait for every frame to encode."), step("设置合成参数", "Set creation options", "选择帧顺序，设置每帧 50–2000 ms 和 64–1200 像素输出宽度。", "Set frame order, delay from 50–2000 ms, and output width from 64–1200 px."), step("生成动画", "Create the animation", "点击合成并下载 GIF；图片会按统一输出宽度缩放。", "Create and download GIF; frames are scaled to the chosen width."), step("播放检查", "Check playback", "本地打开 GIF，核对顺序、速度和裁切。", "Open the GIF locally and verify order, speed, and framing.")],
    [text("拆帧 ZIP 中 PNG 数量与 GIF 帧数一致。", "The PNG count in the ZIP matches the GIF frame count."), text("生成 GIF 能循环播放，且帧顺序与选择顺序一致。", "The created GIF loops and follows the selected frame order.")],
    [text("超过 300 帧时先在其他工具缩短动画。", "Shorten GIFs over 300 frames before extraction."), text("总像素过大时减少帧数或输出宽度。", "Reduce frame count or output width when total pixels are too high."), text("不同宽高比图片可能缩放不一致，合成前先统一画布。", "Images with different aspect ratios may scale inconsistently; standardize canvases first.")],
    6,
  ),
  "/audio-tools": guide(
    [text("选择浏览器可解码的音频文件；输出统一为 WAV。", "Choose audio the browser can decode; output is WAV."), text("较长音频会占用更多内存。", "Longer audio uses more memory.")],
    [step("选择音频", "Choose audio", "加载文件后等待浏览器解码并显示总时长。", "Load the file and wait for browser decoding and duration display."), step("设置裁剪范围", "Set trim range", "输入开始和结束时间，确保结束晚于开始。", "Set start and end times, ensuring end is after start."), step("调整音量", "Adjust volume", "根据需要设置输出音量。", "Set output volume as needed."), step("设置淡入淡出", "Set fades", "使用淡入和淡出避免片段边缘爆音。", "Use fade-in and fade-out to avoid clicks at clip boundaries."), step("导出 WAV", "Export WAV", "处理并下载，在播放器中检查时长和声道。", "Process and download WAV, then verify duration and channels in a player.")],
    [text("输出时长等于结束时间减开始时间。", "Output duration equals end time minus start time."), text("片头片尾没有突兀爆音，音量符合预期。", "The clip has no abrupt edge clicks and volume matches expectations.")],
    [text("无法解码时换用常见 MP3、WAV、AAC 或浏览器支持格式。", "If decoding fails, use MP3, WAV, AAC, or another browser-supported format."), text("内存不足时先裁短音频或降低源文件长度。", "If memory is insufficient, shorten the source audio first."), text("WAV 文件通常比压缩音频大，这是无损 PCM 输出的正常现象。", "WAV is usually larger than compressed audio because it contains PCM data.")],
    5,
  ),
  "/video-tools": guide(
    [text("选择当前浏览器可播放的视频。", "Choose a video the current browser can play."), text("静音片段最长 60 秒，并按实际播放速度生成。", "Muted clips are limited to 60 seconds and are generated in real time.")],
    [step("选择视频", "Choose a video", "加载后用播放器定位到需要的画面。", "Load the video and seek to the needed frame."), step("设置片段范围", "Set clip range", "输入开始和结束秒数，片段必须有效且不超过 60 秒。", "Enter valid start and end times with a duration no longer than 60 seconds."), step("选择输出旋转", "Choose output rotation", "根据拍摄方向选择 0°、90°、180° 或 270°。", "Choose 0°, 90°, 180°, or 270° based on capture orientation."), step("导出当前帧", "Export the current frame", "在目标时间暂停并导出 PNG。", "Pause at the target time and export PNG."), step("导出静音片段", "Export a muted clip", "开始实时生成 WebM，保持页面开启直到下载。", "Generate the muted WebM in real time and keep the page open until download.")],
    [text("PNG 对应播放器当前时间和旋转设置。", "The PNG matches the player's current time and rotation."), text("WebM 片段时长正确且没有音轨。", "The WebM has the correct duration and no audio track.")],
    [text("浏览器不支持源编码时先转为常见 MP4/H.264 或 WebM。", "If the browser cannot play the source codec, convert it to common MP4/H.264 or WebM first."), text("结束时间必须大于开始时间且相差不超过 60 秒。", "End must be after start and no more than 60 seconds later."), text("实时生成耗时接近片段时长，期间不要切换或关闭页面。", "Real-time generation takes about the clip duration; do not close the page.")],
    5,
  ),
  "/screen-recorder": guide(
    [text("使用最新版 Chrome、Edge、Firefox 或 Safari，并通过 HTTPS 打开。", "Use a current Chrome, Edge, Firefox, or Safari over HTTPS."), text("只有点击开始后浏览器才会请求屏幕/窗口/标签页权限。", "The browser requests screen/window/tab permission only after Start is selected.")],
    [step("开始共享", "Start sharing", "点击“选择屏幕并开始”，在浏览器面板选择屏幕、窗口或标签页。", "Select Choose a screen and start, then pick a screen, window, or tab in the browser panel."), step("选择音频选项", "Choose audio options", "浏览器支持时决定是否共享标签页声音或麦克风。", "When supported, decide whether to include tab audio or microphone input."), step("进行录制", "Record", "授权后开始计时；停止共享也会结束录制。", "Recording starts after permission; stopping screen sharing also ends it."), step("停止并预览", "Stop and preview", "点击停止录制，等待浏览器生成可播放结果。", "Stop recording and wait for the browser to produce a playable result."), step("下载录像", "Download recording", "预览确认后下载 WebM，部分浏览器可能输出 MP4。", "Preview and download WebM; some browsers may produce MP4.")],
    [text("预览能完整播放，画面范围与共享选择一致。", "The preview plays fully and matches the selected share surface."), text("下载文件大小与时长合理，并能在目标播放器打开。", "Downloaded size and duration are reasonable and the file opens in the target player.")],
    [text("NotAllowedError 表示授权取消或被阻止，重新点击并在浏览器面板确认。", "NotAllowedError means permission was cancelled or blocked; start again and confirm in the browser panel."), text("没有音频时确认共享面板中的系统/标签页音频选项。", "If audio is missing, check the system/tab-audio option in the share panel."), text("移动浏览器或无 HTTPS 环境可能不支持屏幕录制。", "Mobile browsers or non-HTTPS contexts may not support screen recording.")],
    6,
  ),
}

export const toolGuides: ToolGuide[] = allTools.map((tool) => {
  const details = guideByHref[tool.href]
  if (!details) throw new Error(`Missing tool guide for ${tool.href}`)
  const category = getCategory(tool.category)
  return {
    slug: tool.href.slice(1),
    href: tool.href,
    title: tool.title,
    titleEn: tool.titleEn,
    description: tool.description,
    descriptionEn: tool.descriptionEn,
    category: tool.category,
    categoryTitle: category.title,
    categoryTitleEn: category.titleEn,
    runtime: tool.runtime,
    ...details,
  }
})

export const toolGuidesUpdatedAt = "2026-07-15"

export function getToolGuide(slug: string) {
  return toolGuides.find((item) => item.slug === slug)
}

export function getRelatedToolGuides(guideItem: ToolGuide, limit = 3) {
  return toolGuides.filter((item) => item.category === guideItem.category && item.slug !== guideItem.slug).slice(0, limit)
}
