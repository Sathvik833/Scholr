import json
import os
from pathlib import Path
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


def load_local_env_file() -> None:
    env_path = Path(__file__).with_name(".env")
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_local_env_file()

app = FastAPI(title="Scholr.ai Backend")


# Frontend (Next.js) typically runs on localhost:3000 during development.
frontend_url = os.getenv("FRONTEND_URL", "").strip()
allowed_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
if frontend_url and frontend_url not in allowed_origins:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Ratings(BaseModel):
    career: int = Field(ge=1, le=5)
    affordability: int = Field(ge=1, le=5)
    food: int = Field(ge=1, le=5)
    gym: int = Field(ge=1, le=5)
    study: int = Field(ge=1, le=5)
    social: int = Field(ge=1, le=5)
    academicRep: int = Field(ge=1, le=5)


class PreferencesPayload(BaseModel):
    gpa: str = ""
    intendedMajor: str = ""
    incomeRange: str = ""
    firstGen: Literal["yes", "no", ""] | str = ""
    location: str = ""
    extracurricularStrength: str = ""
    leadershipStrength: str = ""
    preferredRegion: str = ""
    schoolSize: str = ""
    campusSetting: str = ""
    ratings: Ratings


ALLOWED_CATEGORIES = {"Reach", "Target", "Safety", "Hidden Gem"}


def _as_int(value: Any, default: int = 0, low: int = 0, high: int = 100) -> int:
    try:
        n = int(round(float(value)))
    except (TypeError, ValueError):
        n = default
    return max(low, min(high, n))


def _as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_matches(raw_matches: Any) -> list[dict[str, Any]]:
    if not isinstance(raw_matches, list):
        return []

    normalized: list[dict[str, Any]] = []
    for idx, item in enumerate(raw_matches[:5], start=1):
        if not isinstance(item, dict):
            continue

        college = item.get("college", {}) if isinstance(item.get("college"), dict) else {}
        scores = item.get("scores", {}) if isinstance(item.get("scores"), dict) else {}

        category = scores.get("category", "Target")
        if category not in ALLOWED_CATEGORIES:
            category = "Target"

        normalized.append(
            {
                "college": {
                    "id": college.get("id", f"demo-{idx}"),
                    "name": str(college.get("name", "Unknown College")).strip() or f"College {idx}",
                    "acceptRate": round(_as_float(college.get("acceptRate"), 50.0), 1),
                    "tuition": _as_int(college.get("tuition"), default=35000, low=0, high=120000),
                },
                "scores": {
                    "matchScore": _as_int(scores.get("matchScore"), default=70),
                    "academicFit": _as_int(scores.get("academicFit"), default=70),
                    "financialFit": _as_int(scores.get("financialFit"), default=70),
                    "lifestyleFit": _as_int(scores.get("lifestyleFit"), default=70),
                    "careerFit": _as_int(scores.get("careerFit"), default=70),
                    "category": category,
                },
                "reasoning": str(item.get("reasoning", "Good overall fit for your profile.")).strip(),
            }
        )

    normalized.sort(key=lambda m: m["scores"]["matchScore"], reverse=True)
    return normalized



async def generate_matches_with_openai(payload: PreferencesPayload) -> list[dict[str, Any]]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY in backend environment.")

    system_prompt = (
        "You are a demo college matcher. "
        "Return JSON only with key matches (5 items). "
        "Each item must have college{id,name,acceptRate,tuition}, "
        "scores{matchScore,academicFit,financialFit,lifestyleFit,careerFit,category}, "
        "and short reasoning. "
        "Category must be Reach, Target, Safety, or Hidden Gem."
    )

    user_prompt = json.dumps(payload.model_dump(), ensure_ascii=False)

    def parse_json_from_content(content: Any) -> dict[str, Any] | None:
        raw_text = ""
        if isinstance(content, str):
            raw_text = content.strip()
        elif isinstance(content, list):
            text_parts: list[str] = []
            for part in content:
                if isinstance(part, dict):
                    if isinstance(part.get("text"), str):
                        text_parts.append(part["text"])
                    elif part.get("type") == "output_text" and isinstance(part.get("text"), str):
                        text_parts.append(part["text"])
            raw_text = "\n".join(text_parts).strip()

        if not raw_text:
            return None

        try:
            candidate = json.loads(raw_text)
            if isinstance(candidate, dict):
                return candidate
        except json.JSONDecodeError:
            pass

        first_brace = raw_text.find("{")
        last_brace = raw_text.rfind("}")
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            snippet = raw_text[first_brace:last_brace + 1]
            try:
                candidate = json.loads(snippet)
                if isinstance(candidate, dict):
                    return candidate
            except json.JSONDecodeError:
                return None

        return None

    request_body = {
        "model": "gpt-4o-mini",
        "temperature": 0.1,
        "max_tokens": 700,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    async def call_openai(body: dict[str, Any]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"OpenAI network error: {exc.__class__.__name__}",
            ) from exc

        if response.status_code != 200:
            error_msg = ""
            try:
                error_msg = response.json().get("error", {}).get("message", "")
            except Exception:
                error_msg = response.text[:200]
            raise HTTPException(
                status_code=502,
                detail=f"OpenAI request failed ({response.status_code}). {error_msg}".strip(),
            )

        return response.json()

    data = await call_openai(request_body)
    message = data.get("choices", [{}])[0].get("message", {})
    parsed = parse_json_from_content(message.get("content", ""))

    if parsed is None:
        retry_body = {
            **request_body,
            "temperature": 0.0,
            "max_tokens": 900,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        system_prompt
                        + " Output must be strict JSON only. No markdown, no explanation."
                    ),
                },
                {"role": "user", "content": user_prompt},
            ],
        }
        retry_data = await call_openai(retry_body)
        retry_message = retry_data.get("choices", [{}])[0].get("message", {})
        parsed = parse_json_from_content(retry_message.get("content", ""))

    if parsed is None:
        raise HTTPException(status_code=502, detail="OpenAI returned non-JSON output.")

    return normalize_matches(parsed.get("matches"))


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/preferences")
async def receive_preferences(payload: PreferencesPayload) -> dict[str, Any]:
    try:
        matches = await generate_matches_with_openai(payload)
        return {"success": True, "matches": matches}
    except HTTPException as exc:
        if exc.status_code in {500, 502}:
            return {
                "success": True,
                "matches": [],
                "warning": str(exc.detail),
            }
        raise
