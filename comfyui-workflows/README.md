# Flux.2 Klein 9B - Equirectangular Panorama to HDRI Workflow

ComfyUI 워크플로우: 등장방형(Equirectangular) 360° 파노라마를 생성하고 HDRI 포맷(.exr, .hdr)으로 저장합니다.

## 필수 모델 파일

| 파일명 | 저장 경로 | 다운로드 |
|--------|----------|---------|
| `flux-2-klein-base-9b-fp8.safetensors` | `ComfyUI/models/diffusion_models/` | [HuggingFace](https://huggingface.co/black-forest-labs/FLUX.2-klein-base-9b-fp8) |
| `qwen_3_8b_fp8mixed.safetensors` | `ComfyUI/models/text_encoders/` | [HuggingFace](https://huggingface.co/black-forest-labs/FLUX.2-klein-base-9B) |
| `flux2-vae.safetensors` | `ComfyUI/models/vae/` | [HuggingFace](https://huggingface.co/black-forest-labs/FLUX.2-klein-base-9B) |

> **주의:** 9B 모델은 FLUX Non-Commercial License 입니다. 상업적 사용은 4B 모델을 사용하세요.

## 필수 커스텀 노드

HDRI 포맷 저장을 위해 아래 커스텀 노드를 설치해야 합니다:

```bash
cd ComfyUI/custom_nodes/

# EXR 32bit 저장 (권장)
git clone https://github.com/spacepxl/ComfyUI-HQ-Image-Save

# HDR (Radiance) 포맷 저장
git clone https://github.com/city96/ComfyUI_ColorMod

# (선택) HDR VAE 디코더 - 더 넓은 다이나믹 레인지 보존
git clone https://github.com/netocg/vae-decode-hdr

# (선택) 360° 미리보기
git clone https://github.com/ProGamerGov/ComfyUI_preview360panorama
```

설치 후 ComfyUI를 재시작하세요.

## 워크플로우 사용법

1. `flux2-klein-9b-equirectangular-hdri.json` 파일을 ComfyUI에 드래그 앤 드롭
2. 프롬프트를 원하는 배경으로 수정
3. Queue Prompt 실행
4. 결과물이 `output/hdri/` 폴더에 저장됨

## 워크플로우 노드 구성

```
[UNETLoader] ──→ [KSampler] ──→ [VAE Decode] ─┬→ [SaveEXR]       (.exr 32bit)
[CLIPLoader] ─┬→ [Positive]  ──→              │→ [SaveImageHDR]  (.hdr Radiance)
              └→ [Negative]  ──→              └→ [SaveImage]     (.png 미리보기)
[VAELoader]  ────────────────────→
[EmptyLatentImage (2048×1024)] ──→
```

## 주요 설정값

| 항목 | 값 | 비고 |
|------|------|------|
| 해상도 | 2048 × 1024 | 2:1 비율 (등장방형 필수) |
| Steps | 25 | Base 모델 기준 (Distilled는 4) |
| CFG | 3.5 | |
| Sampler | euler | |
| Scheduler | normal | |
| sRGB_to_linear | true | EXR 저장 시 linear 색공간 변환 |

## 프롬프트 팁

등장방형 파노라마 생성 시 아래 키워드를 포함하면 품질이 향상됩니다:

```
equirectangular 360 degree panorama, HDRI environment map,
seamless spherical projection, [장면 설명],
high dynamic range, photorealistic
```

### 예시 프롬프트

**실외 자연 환경:**
```
equirectangular 360 degree panorama, HDRI environment map,
seamless spherical projection, mountain landscape with lake,
dramatic sunset sky, volumetric clouds, golden hour,
high dynamic range, photorealistic, 8k
```

**실내 스튜디오:**
```
equirectangular 360 degree panorama, HDRI environment map,
seamless spherical projection, modern photography studio interior,
softbox lighting, white walls, professional setup,
high dynamic range, photorealistic
```

**도시 환경:**
```
equirectangular 360 degree panorama, HDRI environment map,
seamless spherical projection, urban cityscape at night,
neon lights, skyscrapers, wet street reflections,
high dynamic range, photorealistic, 8k
```

## 진정한 HDR 출력을 위한 고급 설정

기본 VAE Decode는 0~1 범위의 LDR 데이터를 출력합니다.
실제 HDRI 조명용으로 더 넓은 다이나믹 레인지가 필요하다면:

1. **VAE Decode HDR** 노드를 설치하고 기본 VAE Decode 대신 사용
2. 반드시 SaveEXR 노드에 직접 연결 (기본 SaveImage 사용 금지)
3. `sRGB_to_linear = true` 설정으로 linear 색공간 유지

## 출력 파일 활용

생성된 HDRI 파일은 아래 3D 소프트웨어에서 환경 맵으로 사용 가능합니다:

- **Blender** → World Properties → Environment Texture
- **Unreal Engine** → HDRI Backdrop / Sky Light
- **Unity** → Lighting → Environment → Skybox Material
- **Cinema 4D** → Sky Object → HDR Texture
- **3ds Max** → Environment → Bitmap (HDR/EXR)

## 하드웨어 요구사항

- VRAM: 최소 24GB (RTX 4090 권장)
- 9B FP8 모델 기준 1024×1024 이미지 약 30초 (20 steps)
- 2048×1024 해상도는 VRAM 사용량이 더 높으므로 주의
