# AI Image Trace Cleaner Evaluation

## Objective

Improve the one-click image cleanup flow without changing detector verdicts in
code or inventing camera provenance. The output should remove supported visible
platform marks and removable file fields, then reduce fragile pixel-level
delivery patterns with a restrained browser-only transform.

## GitHub approaches reviewed

- [BorderlessX/Deepfake-Detection-Bypass-Gradio](https://github.com/BorderlessX/Deepfake-Detection-Bypass-Gradio)
  and its upstream utility combine Gaussian/random pixel perturbation, Fourier
  processing, camera simulation, and JPEG output. The repository is MIT
  licensed.
- Its
  [camera pipeline](https://github.com/BorderlessX/Deepfake-Detection-Bypass-Gradio/blob/main/image_postprocess/camera_pipeline.py)
  models sensor noise, optical effects, blur, and recompression.
- Its
  [processor](https://github.com/BorderlessX/Deepfake-Detection-Bypass-Gradio/blob/main/image_postprocess/processor.py)
  composes the available transformations and can also write fake EXIF.

## Product decision

Integrated in TabNative:

1. High-quality 92% downsample and same-size reconstruction.
2. Subtle signal-dependent sensor grain with small chroma variation.
3. Clean JPEG re-encoding at quality 90 for opaque images.
4. PNG output with the original alpha channel preserved for transparent images.
5. A strict post-clean visible-mark verification before download is offered.

Not integrated:

- Fake EXIF or camera metadata. It creates misleading provenance and does not
  improve the pixel content.
- Reference-based Fourier matching. It needs a genuine camera reference,
  increases browser CPU/memory use, and was unnecessary for the reproduced
  Gemini sample.
- Heavy optical distortion, hot pixels, or banding. The quality cost is too high
  for a default one-click delivery tool.
- Any detector-result override. The cleaned file must pass the same detector as
  every other uploaded file.

## Root-cause fix

The reproduced cleaned Gemini image already produced a 29% raw pixel estimate.
Its 94% final result came from a weak SDK `validated-match` in the repaired
bottom-right corner. Cleanup candidates and detector evidence now use separate
thresholds: a weak candidate may still be repaired, but only a strong spatial
and gradient match may become deterministic Gemini evidence.

## Acceptance check

- Untreated Gemini sample: AI-generated, 99% in the full local workflow.
- Cleaned output: visible-mark verification passed, zero remaining file signals,
  and not AI-generated at 49% in the same full workflow.
- No source image or result is sent to the TabNative server.

These checks validate the current TabNative detector, not every third-party
classifier. External models can still reach different conclusions.
