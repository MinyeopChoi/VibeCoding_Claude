# ComfyUI MCP Server 리서치 보고서

> 작성일: 2026-03-23

## 개요

ComfyUI는 Stable Diffusion 기반의 노드 기반 그래픽 인터페이스로, 커스텀 이미지 생성 파이프라인을 구축할 수 있는 도구입니다. MCP(Model Context Protocol)는 Anthropic이 2024년 말 발표한 오픈 표준으로, AI 에이전트가 외부 도구/API와 표준화된 방식으로 상호작용할 수 있게 합니다.

현재 GitHub에 다수의 ComfyUI MCP 서버 프로젝트가 활발히 개발되고 있습니다.

---

## 주요 프로젝트 비교

| 프로젝트 | 언어 | Stars | 도구 수 | 특징 | 라이선스 |
|---------|------|-------|--------|------|---------|
| [artokun/comfyui-mcp](https://github.com/artokun/comfyui-mcp) | Node.js | 14 | 31 | Claude Code 플러그인, 슬래시 커맨드, 에이전트 | MIT |
| [joenorton/comfyui-mcp-server](https://github.com/joenorton/comfyui-mcp-server) | Python | 234 | 15+ | 경량, Streamable HTTP, 자동 워크플로 발견 | Apache 2.0 |
| [shawnrushefsky/comfyui-mcp](https://github.com/shawnrushefsky/comfyui-mcp) | Node.js | 7 | 20+ | Docker 지원, 70+ 예제 워크플로, 자동 구성 | - |
| [alecc08/comfyui-mcp](https://github.com/alecc08/comfyui-mcp) | - | - | - | txt2img, img2img, 이미지 리사이즈, HTTP 프록시 | - |
| [IO-AtelierTech/comfyui-mcp](https://github.com/IO-AtelierTech/comfyui-mcp) | - | - | - | 워크플로 자동화, 시스템 모니터링 | - |
| [lalanikarim/comfy-mcp-server](https://github.com/lalanikarim/comfy-mcp-server) | Python | - | - | FastMCP 프레임워크, Ollama 연동 가능 | - |

---

## Top 3 상세 분석

### 1. artokun/comfyui-mcp (가장 풍부한 기능)

Claude Code와의 통합이 가장 깊은 프로젝트입니다.

**핵심 수치:**
- 31개 MCP 도구 (13개 카테고리)
- 10개 슬래시 커맨드
- 4개 지식 스킬
- 3개 자율 에이전트 (탐색, 디버깅, 최적화)
- 3개 훅 (VRAM 모니터링, 저장 경고, 작업 완료 알림)

**MCP 도구 카테고리:**

| 카테고리 | 도구 수 | 주요 도구 |
|---------|--------|----------|
| Workflow Execution | 5 | enqueue_workflow, get_job_status, get_queue, cancel_job |
| Workflow Visualization | 2 | visualize_workflow (Mermaid), mermaid_to_workflow |
| Workflow Composition | 3 | create_workflow, modify_workflow, get_node_info |
| Workflow Validation | 1 | validate_workflow |
| Workflow Library | 3 | list/get/save_workflows |
| Image Management | 3 | upload_image, workflow_from_image, list_output_images |
| Model Management | 3 | search_models (HuggingFace), download_model, list_local_models |
| Memory Management | 2 | clear_vram, get_embeddings |
| Registry & Discovery | 3 | search_custom_nodes, get_node_pack_details, generate_node_skill |
| Diagnostics | 2 | get_logs, get_history |
| Process Control | 3 | stop/start/restart_comfyui |
| Generation Tracker | 2 | suggest_settings, generation_stats |

**슬래시 커맨드:**
- `/comfy:gen <prompt>` - 자연어로 이미지 생성
- `/comfy:viz <workflow>` - Mermaid 다이어그램으로 시각화
- `/comfy:debug [prompt_id]` - 실패한 워크플로 진단
- `/comfy:batch <prompt, params>` - 파라미터 스윕 생성
- `/comfy:convert <file>` - UI ↔ API 워크플로 변환
- `/comfy:install <pack>` - 커스텀 노드 팩 설치
- `/comfy:gallery [filter]` - 출력 이미지 브라우징
- `/comfy:compare <a vs b>` - 두 워크플로 비교
- `/comfy:recipe <name> <prompt>` - 멀티스텝 레시피 실행

**설치:**
```json
{
  "mcpServers": {
    "comfyui": {
      "command": "npx",
      "args": ["-y", "comfyui-mcp"],
      "env": {
        "CIVITAI_API_TOKEN": ""
      }
    }
  }
}
```

또는 Claude Code 플러그인으로 설치:
```bash
claude plugin install comfyui-mcp
```

**요구사항:** Node.js >= 22.0.0, ComfyUI 로컬 실행

---

### 2. joenorton/comfyui-mcp-server (가장 인기, 경량)

GitHub Stars가 234개로 가장 인기 있는 프로젝트입니다.

**핵심 특징:**
- Python 기반 경량 서버
- Streamable HTTP 트랜스포트 (WebSocket 아님)
- 워크플로 자동 발견 (`workflows/` 디렉토리에 JSON 배치)
- PARAM_* 플레이스홀더를 통한 파라미터 자동 노출
- 반복 리파인먼트 (regenerate 기능)
- 에셋 ID 시스템 (세션 간 안정적 참조)

**MCP 도구:**
- **Generation:** generate_image, generate_song, regenerate
- **Viewing:** view_image
- **Job Management:** get_queue_status, get_job, list_assets, get_asset_metadata, cancel_job
- **Configuration:** list_models, get_defaults, set_defaults
- **Workflows:** list_workflows, run_workflow
- **Publishing:** get_publish_info, set_comfyui_output_root, publish_asset

**설치:**
```bash
git clone https://github.com/joenorton/comfyui-mcp-server.git
pip install -r requirements.txt
python server.py  # http://127.0.0.1:9000/mcp
```

**요구사항:** Python 3.8+, ComfyUI 로컬 (포트 8188)

---

### 3. shawnrushefsky/comfyui-mcp (Docker 기반, 풍부한 예제)

Docker 기반으로 설치가 가장 간편하며, 70개 이상의 예제 워크플로를 제공합니다.

**핵심 특징:**
- Docker 원클릭 배포 (`--pull always`로 자동 업데이트)
- 자동 구성 (ComfyUI 설치 자동 감지)
- 70+ 예제 워크플로 (Flux, SDXL, SD3.5, ControlNet, SVD, Mochi, LTX-Video 등)
- ComfyUI 미실행 상태에서도 설치 가이드/모델 다운로드 가능
- 에이전트 메모리 (save_note, get_notes, search_notes)

**MCP 도구:**
- **Setup & Status:** get_status, get_install_guide, get_model_guide
- **Templates & Workflows:** search_templates, get_template, save_template, list_examples
- **Generation:** run_workflow, validate_workflow, get_image
- **Workflow Composition:** build_node, get_node_info, find_nodes_by_type, list_nodes
- **Queue Management:** get_task, list_tasks, cancel_task, get_queue
- **Discovery:** get_capabilities, list_models
- **Agent Memory:** save_note, get_notes, search_notes

**Docker 설치:**
```json
{
  "mcpServers": {
    "comfyui": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm", "--pull", "always",
        "-e", "COMFYUI_URL=http://host.docker.internal:8000",
        "ghcr.io/shawnrushefsky/comfyui-mcp:latest"
      ]
    }
  }
}
```

**지원 클라이언트:** Claude Desktop, Claude Code, Cursor, Windsurf, Cline (VS Code)

**요구사항:** Docker 또는 Node.js 18+, ComfyUI, 최소 1개 체크포인트 모델

---

## 추천

| 사용 목적 | 추천 프로젝트 |
|----------|-------------|
| Claude Code와 깊은 통합 (슬래시 커맨드, 에이전트, 훅) | **artokun/comfyui-mcp** |
| 가장 인기있고 안정적인 경량 서버 | **joenorton/comfyui-mcp-server** |
| Docker 기반 간편 설치 + 풍부한 예제 | **shawnrushefsky/comfyui-mcp** |
| 간단한 txt2img/img2img만 필요 | **alecc08/comfyui-mcp** |
| FastMCP + Ollama 프롬프트 생성 | **lalanikarim/comfy-mcp-server** |

---

## Sources

- [artokun/comfyui-mcp (GitHub)](https://github.com/artokun/comfyui-mcp)
- [joenorton/comfyui-mcp-server (GitHub)](https://github.com/joenorton/comfyui-mcp-server)
- [shawnrushefsky/comfyui-mcp (GitHub)](https://github.com/shawnrushefsky/comfyui-mcp)
- [alecc08/comfyui-mcp (GitHub)](https://github.com/alecc08/comfyui-mcp)
- [IO-AtelierTech/comfyui-mcp (GitHub)](https://github.com/IO-AtelierTech/comfyui-mcp)
- [lalanikarim/comfy-mcp-server (GitHub)](https://github.com/lalanikarim/comfy-mcp-server)
- [ComfyUI MCP Servers (MCP Market)](https://mcpmarket.com/businesses/comfyui)
- [PulseMCP - ComfyUI Servers](https://www.pulsemcp.com/servers/lalanikarim-comfy-ui)
