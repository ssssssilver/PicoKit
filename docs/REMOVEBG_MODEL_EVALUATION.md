# TabNative Remove Background 模型升级评估与接入建议

- 评估日期：2026-07-15
- 状态：Implemented，产品已统一为单一“移除图片背景”流程；完整设备矩阵与 60 张质量基准仍待完成
- 范围：`/remove-background` 本地抠图功能
- 当前决策摘要：前台与 Worker 统一使用固定版本 U²-NetP，不再要求用户区分人物或物体，也不再加载 MODNet。人物、商品等仅作为适用场景说明，不作为功能名称或模式。BiRefNet Lite 因浏览器 WebGPU 图执行限制撤回，BEN2 仍不接入。

## 0.1 2026-07-16 单流程调整

- 实际验证确认 U²-NetP 可以同时处理人物与常见物体，因此两套入口带来的选择成本高于当前专用人像模型的收益。
- 页面统一命名为“移除图片背景 / Remove Image Background”，删除人像/物体模式卡片和结果模式标签。
- Worker、模型代理白名单和许可证清单同步移除 MODNet，只保留约 4.6 MB 的 U²-NetP 下载与 WebGPU → WASM CPU 回退。
- 此调整会牺牲专用人像模型在部分极细发丝和柔边上的自动精度。页面已把细发丝列为可能需要手动修边的场景；60 张质量基准仍应补齐，用于决定未来是否需要独立的高清实验能力，而不是重新增加主体类型选择。

## 0. 2026-07-16 根因复核与实施记录

- 已加入“人像背景移除”和“通用物体去背景”两个并列入口；默认仍为人像，页面不会自动猜测主体或预取通用模型。
- 原 BiRefNet Lite 方案可以下载和初始化，但真实推理会稳定失败：`/decoder/Split_33` 生成的着色器需要 11 个 storage buffer，而浏览器 WebGPU 后端上限为 10。该错误与用户图片尺寸、清晰度无关，不能通过重试或缩小图片解决。
- 通用模式已替换为 `Heliosoph/u2net-onnx@7fc34deee10329bc039c10a73b98090d0c6f5c59` 的 `u2netp.onnx`。文件固定为 4,574,861 字节，SHA-256 为 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`，许可证为 Apache-2.0。
- U²-NetP 使用 320×320 RGB ImageNet 归一化输入。已在同一台 RTX 4070 Ti SUPER 设备上验证 WebGPU 和 WASM 输出有效遮罩；WebGPU 失败时会在同一任务内自动重建为 WASM 会话并重试。
- 模型代理已加入精确仓库白名单，继续只接受 GET/HEAD，并保留 Range、ETag 和缓存验证请求头。
- 页面、教程、方法说明、许可证和 11 种非中英文语言文本已同步更新。
- 尚未完成本文第 7 节的 60 张质量基准及全部真实设备 P95 记录，因此当前接入证明“功能可运行”，不代表所有通用物体场景均达到发布级质量门槛。

## 1. 结论

接入前的功能只能稳定处理人像，主要原因不是页面逻辑错误，而是模型本身的能力边界。`Xenova/modnet` 是人像抠图模型，适合单人、清晰轮廓、头发和衣物柔边，不适合作为商品、动物、车辆、家具和复杂多主体图片的通用背景移除模型。

当前已采用多模式，而不是用一个更大的模型覆盖所有场景：

1. **快速人像**：继续使用 `Xenova/modnet`。模型小、已有 WebGPU 和 WASM 回退、当前体验成熟。
2. **通用物体**：使用 `Heliosoph/u2net-onnx` 的 U²-NetP。模型约 4.6 MB，面向通用显著物体分割，WebGPU 与 WASM 均已跑通。
3. **高清边缘，实验**：评测 `onnx-community/BEN2-ONNX`，但只允许用户主动加载。其 FP16 权重约 219 MB，不适合成为默认首屏资源。
4. **边缘修正**：在模型模式之外增加保留画笔、擦除画笔和边缘软化。模型无法稳定解决玻璃、薄纱、烟雾、阴影和极低对比边缘，手动修正是完整产品能力的一部分。

推荐方案完整度：**9/10**。覆盖模型选择、回退、许可证、浏览器资源限制、评测和发布门槛；暂不包含服务端 GPU 推理，因为它会改变 TabNative 当前“图片不上传”的产品边界。

## 2. 当前实现与限制

当前处理链路如下：

```text
用户图片
  -> 浏览器 Web Worker
  -> 用户选择模式
       -> 人像：Xenova/modnet，WebGPU FP16 / WASM Q8
       -> 通用物体：U²-NetP，WebGPU / WASM
  -> 透明 PNG
  -> 下载 / 快速修图 / 图片优化
```

代码事实：

- [`workers/background-removal.worker.ts`](../workers/background-removal.worker.ts) 按受控模式加载固定 revision：人像和通用物体均优先 WebGPU 并回退 WASM；通用失败不会伪装成人像成功。
- [`components/background-remover-tool.tsx`](../components/background-remover-tool.tsx) 并列展示人像与通用物体模式，说明场景、首次准备量、缓存状态和设备能力，并共用对比、修边与后续交付。
- [`lib/model-proxy.ts`](../lib/model-proxy.ts) 只允许代理白名单内的模型。新增模型必须同时更新白名单和相关测试，不能把模型路由变成开放代理。
- [`worker/index.ts`](../worker/index.ts) 只允许模型代理处理 GET/HEAD，并保留 Range 与缓存验证请求头。
- [`app/licenses/page.tsx`](../app/licenses/page.tsx) 已登记 MODNet、U²-NetP 与 ONNX Runtime Web 的固定来源及许可证。任何后续模型仍必须补充许可证和来源。

现有优点应保留：图片像素不上传、推理在独立 Worker 中执行、首次下载后复用浏览器缓存、WebGPU 不可用时能回退、结果可继续进入编辑和压缩流程。

## 3. 选择约束

候选方案必须同时满足：

- 能明显改善商品、动物、车辆、家具和多人场景，而不是只在少数人像样本上更好。
- 模型和代码许可证允许 TabNative 当前及可能的商业用途。
- 能在浏览器运行，图片无需上传到第三方推理服务。
- 首次下载、峰值内存和处理时长对真实用户可接受。
- 失败时能回退到现有 MODNet 或给出明确提示，不能让页面失去可用路径。
- 模型来源固定、可审计，代理仍使用明确白名单。

## 4. 候选方案对比

模型大小按 2026-07-15 对应仓库中的 ONNX 文件记录，后续上游更新可能改变文件大小。

| 候选 | 主要能力 | 浏览器权重 | 许可证 | 与当前架构适配 | 建议 |
| --- | --- | ---: | --- | --- | --- |
| `Xenova/modnet` | 人像抠图、发丝和柔边 | Q8 约 6.6 MB；FP16 约 13 MB | Apache-2.0 | 已接入，WebGPU/WASM 均可用 | 保留为默认快速人像模式 |
| `Heliosoph/u2net-onnx` / U²-NetP | 通用显著物体 | 约 4.6 MB | Apache-2.0 | 已验证 WebGPU/WASM 与透明 PNG 合成 | **当前正式通用模式** |
| `onnx-community/BiRefNet_lite-ONNX` | 通用显著物体、边缘和细节 | FP16 约 115 MB；FP32 约 224 MB | MIT | 初始化成功，但推理图超出 WebGPU storage buffer 上限 | 已撤回 |
| `onnx-community/BEN2-ONNX` | 通用背景移除、头发和细边缘 | FP16 约 219 MB | MIT | 提供 Transformers.js `background-removal` 示例，接入较直接 | 仅作高清实验模式 |
| BiRefNet 完整版 ONNX | 更高容量的通用分割 | FP16 约 490 MB；FP32 约 973 MB | MIT | 首次下载和内存压力过高 | 不进入浏览器默认候选 |
| BRIA RMBG-2.0 | 通用背景移除 | 体积较大 | 权重默认 CC BY-NC 4.0；商业用途需另行授权 | 技术上可行，商业许可不满足默认要求 | 未取得商业授权前排除 |
| IMG.LY Background Removal | 封装好的浏览器移除背景方案 | 由其运行时和模型决定 | AGPL-3.0 或商业许可 | 产品集成方便，但分发义务需单独评估 | 仅在接受 AGPL 或购买许可时考虑 |
| `rembg` | Python 工具和多模型封装 | 取决于所选模型 | 工具本身 MIT，模型许可证各自判断 | 适合服务端 Python，不是当前浏览器 Worker 的直接替代 | 仅在未来允许服务端推理时考虑 |

### 4.1 MODNet

MODNet 的官方定位是实时人像抠图。当前 ONNX 版本小，且已经验证了 WebGPU、WASM、缓存、代理和透明 PNG 输出。它不是应该被删除的旧实现，而是一个用途明确、速度和下载成本都很好的专用模式。

局限：通用物体不是其训练目标。继续扩大页面文案或通过阈值调整，无法从根本上解决商品、宠物和车辆被误删的问题。

来源：[MODNet ONNX 模型卡](https://huggingface.co/Xenova/modnet)、[ONNX 文件](https://huggingface.co/Xenova/modnet/tree/main/onnx)

### 4.2 BiRefNet Lite（已撤回）

BiRefNet 面向高分辨率显著物体检测和二分图像分割，质量能力仍有吸引力，但当前 Lite ONNX 图不适合 TabNative 的浏览器 WebGPU 生产路径。

实际复核确认：模型加载阶段可以接近完成，但推理必定在 `/decoder/Split_33` 失败。ONNX Runtime WebGPU 生成的该着色器需要 11 个 storage buffer，而当前后端允许 10 个。输入图片缩小后模型内部图结构不变，因此用户看到的“换更小图片重试”提示并不能解决问题。

- 不再把 BiRefNet Lite 加入模型代理白名单。
- 不再向用户下载 115 MB 的不可执行权重。
- 除非上游图重写、ONNX Runtime 限制或浏览器 WebGPU 能力发生可验证变化，否则不重新启用。

来源：[BiRefNet 官方仓库](https://github.com/ZhengPeng7/BiRefNet)、[MIT 许可证](https://github.com/ZhengPeng7/BiRefNet/blob/main/LICENSE)、[BiRefNet Lite ONNX 模型卡](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX)、[ONNX 文件](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX/tree/main/onnx)

### 4.3 U²-NetP

U²-NetP 是 U²-Net 的轻量版本，输入固定为 320×320 RGB，适合商品、动物、车辆、家具和图标等主体明显的通用图片。当前 ONNX 权重约 4.6 MB，浏览器首次准备成本远低于 BiRefNet Lite。

实现直接使用 ONNX Runtime Web：优先创建 WebGPU 会话，适配器不可用、会话创建失败或 GPU 推理失败时自动使用 WASM。第一输出作为最终显著性遮罩，经有限值检查和 min-max 归一化后，缩放回原图尺寸并写入透明 PNG Alpha 通道。模型文件同时校验固定长度和 SHA-256，避免缓存或代理返回损坏文件。

来源：[U²-NetP ONNX 模型卡](https://huggingface.co/Heliosoph/u2net-onnx)、[ONNX 文件](https://huggingface.co/Heliosoph/u2net-onnx/tree/main)

### 4.4 BEN2

BEN2 的开源基础模型和 ONNX 导出采用 MIT 许可证，ONNX 模型卡提供 Transformers.js `background-removal` 使用方式，概念验证可能比 BiRefNet Lite 更快。

主要问题是 FP16 权重约 219 MB。首访下载、移动网络耗时、浏览器存储和显存占用都明显高于当前 13 MB 的 MODNet。因此它适合“高清边缘，实验”入口，并应在下载前显示模型大小和设备要求，不适合静默加载或成为默认模式。

来源：[BEN2 官方仓库](https://github.com/PramaLLC/BEN2)、[BEN2 ONNX 模型卡](https://huggingface.co/onnx-community/BEN2-ONNX)、[ONNX 文件](https://huggingface.co/onnx-community/BEN2-ONNX/tree/main/onnx)

## 5. 推荐产品架构

```text
                        +----------------------+
用户选择图片 ---------->+ 场景模式选择           |
                        +----------+-----------+
                                   |
             +---------------------+---------------------+
             |                                           |
     快速人像 / 默认                              通用物体 / 按需
     MODNet                                      U²-NetP
     WebGPU FP16                                 WebGPU
     WASM Q8 回退                                WASM 回退
             |                                           |
             +---------------------+---------------------+
                                   |
                           Alpha 遮罩与 PNG 合成
                                   |
                       保留画笔 / 擦除画笔 / 边缘软化
                                   |
                        下载 / 快速修图 / 图片优化

可选实验路径：高清边缘 -> BEN2 FP16 -> 下载前明确提示约 219 MB
```

### 模式路由

不要自动猜测“人像还是商品”后直接下载大模型。自动分类本身会增加模型、延迟和误路由。首版让用户选择两个清晰选项：

- **Portrait / Fast**：人物头像、半身、全身、发丝。
- **Object / Detailed**：商品、动物、车辆、家具、图标和多人主体。

页面可根据图片和上次选择给出推荐，但最终选择由用户控制。模式切换必须显示预计下载量、是否已缓存和当前后端。

### 失败回退

1. 通用模式的 WebGPU 会话创建或推理失败时，自动在同一 Worker 中创建 WASM 会话并重试一次。
2. WebGPU 与 WASM 均失败时，页面说明“浏览器未能完成处理”，提供重试与手动修边，不自动输出 MODNet 结果并伪装成功。
3. 推理期间保留取消能力，取消后终止 Worker 并释放对象 URL。
4. 内存不足或 WebGPU 设备丢失时，重建 Worker，不复用失败的 pipeline 实例。

## 6. 接入影响范围

正式开发预计会触及以下位置。当前文档不修改这些文件：

| 文件 | 预期变更 |
| --- | --- |
| `workers/background-removal.worker.ts` | 从单一常量改为受控模型配置；分别适配 background-removal 和 image-segmentation 输出；记录实际模型和后端 |
| `components/background-remover-tool.tsx` | 增加模式选择、按需下载提示、模型缓存状态、失败回退和手动边缘修正入口 |
| `lib/model-proxy.ts` | 把通过评测的模型加入精确白名单，继续拒绝任意 Hugging Face 路径 |
| `worker/index.ts` | 原则上不改变代理安全边界；验证大文件 Range、ETag 和缓存行为 |
| `app/licenses/page.tsx` | 登记最终采用的模型、权重仓库、版本或 revision、许可证 |
| `tests/core.test.ts` | 更新允许模型集合；增加非白名单拒绝测试 |
| `tests/privacy-boundary.test.ts` | 保持图片不上传，只允许模型 GET/HEAD 下载 |
| `tests/worker-assets.test.mjs` | 继续验证浏览器 Worker 和 WASM 资产没有进入 Cloudflare Worker 服务端包 |

为避免模型仓库更新导致不可重复结果，生产接入应固定 Hugging Face revision，不只使用浮动的 `main`。如果代理 URL 需要支持 revision，白名单仍应校验仓库名和 `/resolve/` 路径，不能允许用户传入任意上游地址。

## 7. 评测计划

### 7.1 样本集

准备至少 60 张可复测且有使用权的图片，每组 10 张：

1. 单人人像：长发、卷发、浅色头发、帽子、宽松衣物。
2. 商品：鞋、瓶、电子产品、家具、带孔洞或细杆结构的物体。
3. 动物：长毛、短毛、尾巴、耳缘、与背景颜色接近的毛发。
4. 车辆与大型物体：自行车辐条、汽车反光、椅子缝隙、植物枝叶。
5. 多主体与遮挡：多人、人物与道具、主体交叠、主体靠近画面边缘。
6. 困难材质：玻璃、薄纱、半透明塑料、烟雾、阴影、低对比背景。

每张图保留人工确认的参考遮罩或至少两人独立评分。不能只用候选模型自己的输出作为参考答案。

### 7.2 记录指标

质量指标：

- 主体完整度：主体内部是否被误删。
- 背景残留：主体外是否保留明显背景块。
- 细结构：头发、毛发、辐条、叶片、绳索和孔洞。
- 半透明过渡：边缘是否出现硬切、白边、黑边或颜色污染。
- 失败率：空遮罩、全图前景、输出尺寸错误、崩溃和超时。
- 人工偏好：同图盲测时，评审更愿意直接下载哪一个结果。

性能指标：

- 首次模型下载字节数和耗时。
- 冷启动时间，即首次加载并初始化模型所需时间。
- 热启动时间，即模型已缓存后的再次初始化时间。
- 单张推理 P50、P95。
- 峰值内存或显存。
- Chrome、Edge、Firefox、Safari 的成功率。
- 桌面 WebGPU、移动 WebGPU 和 WASM 三类路径的结果。

### 7.3 测试设备

最低覆盖：

- Windows Chrome/Edge，集成显卡和独立显卡各一台。
- macOS Safari 与 Chrome，各一台 Apple Silicon 设备。
- Android Chrome，中档设备一台。
- iPhone Safari，一台仍在支持期内的设备。
- 禁用 WebGPU 的桌面浏览器，用于验证可见的回退行为。

## 8. 接入门槛

U²-NetP 的技术链路已通过单图冒烟测试；正式“通用物体”模式仍应持续满足以下条件：

- 在商品、动物、车辆/家具、多主体四组中，盲测偏好率均明显高于 MODNet，建议门槛为至少 70%。
- 人像组不能出现大面积退化；若退化明显，产品必须保留 MODNet 模式，不能统一切换。
- WebGPU 与 WASM 路径在目标设备上的任务成功率至少 95%，GPU 失败时 CPU 回退可恢复。
- 模型实际下载量、冷启动 P95、热推理 P95 和峰值内存均完成记录，并经过产品负责人确认。
- 许可证、模型来源、revision 和页面披露完成复核。
- 代理白名单、隐私边界、Worker 构建和透明 PNG 输出测试全部通过。

BEN2 进入实验模式前还需要：

- 下载前明确显示约 219 MB 的模型成本。
- 不预加载，不计入首页或工具页首屏资源。
- 在移动设备上默认隐藏或标记为桌面推荐，除非实测证明可接受。
- 浏览器存储不足、下载中断和显存不足均有可恢复提示。

## 9. 分阶段实施

### Phase 0：离线对比，不接入产品

建立 60 张基准集，在固定设备上对 MODNet、U²-NetP 和 BEN2 输出统一格式的遮罩与透明 PNG。记录模型 revision、浏览器版本、设备、后端、下载量、耗时和人工评分。

交付物：样本清单、结果图、CSV/JSON 指标、评测结论。没有这些证据，不进入产品开发。

### Phase 1：通用模式原型

在开发环境加入 U²-NetP WebGPU/WASM 模式，完成输出适配、alpha 合成、取消、错误恢复、完整性校验和模型白名单。不开启自动路由。

### Phase 2：受控发布

增加“快速人像 / 通用物体”选择。通用模型只在用户点击后下载，界面显示大小和缓存状态。保留 MODNet 作为稳定路径。

### Phase 3：边缘修正

增加保留、擦除、软化和撤销。对玻璃、烟雾和阴影等模型边界明确提示需要人工修正。

### Phase 4：高清实验

只有 U²-NetP 已稳定且 BEN2 盲测收益足够大时，才加入 BEN2 桌面实验入口。若收益不足以抵消 219 MB 下载量，则不发布。

## 10. 不采用的捷径

- **直接用任意通用模型替换 MODNet**：会丢失当前低成本、对人像有针对性的路径；两种场景应继续明确区分。
- **页面加载时预取所有模型**：浪费带宽和浏览器存储，尤其影响移动用户和只处理人像的用户。
- **只看模型宣传样图**：无法证明 TabNative 的浏览器导出链路、真实图片类别和设备表现。
- **未授权接入 RMBG-2.0**：模型权重默认非商业许可与潜在商业网站不匹配。
- **把 `rembg` 当作可直接替换的前端模型**：它是 Python 工具和模型封装，采用它意味着新增服务端运行环境或重新实现浏览器导出。
- **只增加更大模型，不提供手动修正**：透明材质和低对比边缘仍会失败，用户无法完成最后一步。

## 11. 风险与缓解

| 风险 | 用户影响 | 缓解方式 |
| --- | --- | --- |
| 首次下载过大 | 等待时间长、移动流量消耗 | 按需加载、显示大小、保留 MODNet、小模型优先 |
| WebGPU 兼容性差异 | 某些设备无法运行通用模式 | 能力检测、真实设备矩阵、可见回退，不静默输出错误结果 |
| 内存或显存不足 | 页面崩溃、浏览器终止 Worker | 限制输入像素、Worker 隔离、失败后销毁实例、桌面限定大模型 |
| 模型更新造成结果漂移 | 同一图片前后结果不同 | 固定 revision，记录模型来源和评测版本 |
| 许可证理解错误 | 商业和分发风险 | 逐个审核代码与权重许可证，在许可证页面登记，不用框架许可证代替模型许可证 |
| 代理范围扩大 | 站点被滥用为开放下载代理 | 继续使用精确模型白名单，只允许 GET/HEAD，测试拒绝其他路径 |
| 模型输出看似成功但主体错误 | 用户下载不可用图片 | 展示前后对比、模式说明、手动修正、保留原图和重试入口 |

## 12. 最终决策记录

**现在可以确认：**

- U²-NetP 比 MODNet 更适合通用物体，且当前固定权重可以在 WebGPU 与 WASM 运行。
- BiRefNet Lite 当前 ONNX 图在浏览器 WebGPU 上存在确定性限制，不能继续作为线上通用模型。
- MODNet 仍应保留，不应因为扩展能力而删除。
- BEN2 值得对比，但 219 MB FP16 权重决定了它不能成为默认模型。
- RMBG-2.0 和 IMG.LY 方案在许可证条件满足前不接入。

**现在不能确认：**

- U²-NetP 在全部 TabNative 目标浏览器与移动设备上的 P95 性能和成功率。
- 60 张基准集中 U²-NetP 对困难材质、低对比边缘和多主体的盲测质量。
- BEN2 相对 U²-NetP 的质量收益是否足以抵消额外下载和内存成本。

当前修复先解决确定性崩溃并恢复可用性；下一步完成 Phase 0 的同图、同设备、同指标对比，再决定是否继续提高边缘质量或增加更重的实验模型。

## 13. 主要来源

- [Transformers.js Pipelines API](https://huggingface.co/docs/transformers.js/en/api/pipelines)
- [MODNet ONNX](https://huggingface.co/Xenova/modnet)
- [U²-NetP ONNX](https://huggingface.co/Heliosoph/u2net-onnx)
- [BiRefNet 官方仓库](https://github.com/ZhengPeng7/BiRefNet)
- [BiRefNet Lite ONNX](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX)
- [BiRefNet 完整版 ONNX 文件](https://huggingface.co/onnx-community/BiRefNet-ONNX/tree/main/onnx)
- [BEN2 官方仓库](https://github.com/PramaLLC/BEN2)
- [BEN2 ONNX](https://huggingface.co/onnx-community/BEN2-ONNX)
- [BRIA RMBG-2.0 模型卡与许可证说明](https://huggingface.co/briaai/RMBG-2.0)
- [IMG.LY Background Removal](https://github.com/imgly/background-removal-js)
- [rembg](https://github.com/danielgatis/rembg)
