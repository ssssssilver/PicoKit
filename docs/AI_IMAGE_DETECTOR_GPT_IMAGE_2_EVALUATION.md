# GPT Image 2 本地检测方案评估

更新日期：2026-07-20

## 结论

上线方案采用三层证据：

1. 使用 MIT 许可的 [`contentauth/c2pa-js`](https://github.com/contentauth/c2pa-js) 在浏览器中读取并验证 C2PA 清单，识别 OpenAI / ChatGPT / GPT Image 与 `trainedAlgorithmicMedia` 声明。
2. 检查当前支持平台的可见 AI 标记。
3. 当来源元数据被移除、截图或重编码后，使用三级 ONNX 像素模型复核；最终一级采用 Community Forensics，并以三模型多数共识与区域一致性保守校准。

OpenAI 官方说明，ChatGPT、Codex 与 API 生成的图片包含 C2PA 元数据和 SynthID 水印，因此 C2PA 是 GPT Image 2 原始文件上最明确、体积最小且可本地验证的开放证据层：<https://help.openai.com/en/articles/8912793-c2pa-in-images>。

页面输出 `AI 可能性` 百分比。它是多层证据经保守校准后的估计，不是作者身份、版权归属或事实真实性证明。原始模型分数、来源字段、通道故障和限制只保留在下载报告中。

## 候选对比

| 候选 | 新生成器覆盖 | 许可 | 浏览器部署 | 决策 |
| --- | --- | --- | --- | --- |
| `contentauth/c2pa-js` | 可验证 GPT Image 2 原始文件中的 OpenAI C2PA | MIT | WASM，本地运行 | 采用，作为强来源证据 |
| `ductai199x/Forensic-Self-Descriptions-CVPR25` | 支持 GPT Image 1/1.5，零样本泛化强 | CC BY-NC-SA 4.0 | PyTorch，约 55 MB 检测权重 | 不采用；广告站点不满足非商业许可 |
| `Bombek1/ai-image-detector-siglip-dinov2` | 训练集包含 GPT Image 1 | MIT | 约 2.1 GB，双编码器 | 不采用；首次下载与内存成本过高 |
| `wkaandemir/ai-image-detector` | 训练集包含 GPT Image 1/1.5 | MIT | 约 343 MB，当前无可直接使用的 Transformers.js ONNX 版本 | 暂不采用；尚无 GPT Image 2 独立验证且浏览器成本偏高 |
| `onnx-community/CommunityForensics-DeepfakeDet-ViT-ONNX` | Community Forensics 覆盖大量生成模型类别 | MIT | WebGPU 约 21 MB / WASM 约 37 MB | 采用，作为第三次像素复核；不替代 GPT Image 2 的 C2PA 来源证据 |
| `vicliv/OpenFake` | 测试集包含 GPT Image 2.0 | CC BY-NC 4.0 | 训练/评测仓库，非轻量浏览器模型 | 只用于研究参考；不可用于广告变现产品 |

## 失效边界

- C2PA 被截图、平台重编码或主动清理后可能消失；此时只能依赖像素统计。
- SynthID 图片检测器目前没有满足本项目要求的可商用开源浏览器实现，不能把“未检出”解释为非 AI。
- 像素模型面对新生成器、强压缩、插画、截图和局部编辑仍会误判，因此报告保留模型层输出和通道状态。
- 可信百分比应定期用独立的 GPT Image 2、相机照片和网络重编码回归集重新校准。
