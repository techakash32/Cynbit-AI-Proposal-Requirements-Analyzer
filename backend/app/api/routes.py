from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse
from starlette.datastructures import UploadFile as StarletteUploadFile

from app.ai.groq import GroqClient
from app.auth.security import (allow_attempt, clear_session_cookies, current_session, hash_password, new_token, require_csrf, secure_cookie, session_expiry, set_session_cookies, token_hash, verify_password)
from app.config import settings
from app.documents.extract import DocumentExtractionError, extract_document
from app.models.schemas import (AnalysisResponse, AnalysisStartResponse, AnalysisStatus, AnalyzeRequest, AnalyzeSettings, LoginRequest, PasswordChangeRequest, ProjectCreate, ProjectPatch, ProjectResponse, ProposalPatch, ProposalResponse, RegenerateSectionRequest, SignupRequest, UnifiedAnalysis, UserProfilePatch, UserResponse)
from app.services.export import docx_bytes, markdown, pdf_bytes
from app.services.pipeline import AnalysisPipeline

router = APIRouter()
MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_TEXT_BYTES = 2_000_000
ALLOWED_SUFFIXES = {".pdf", ".docx", ".txt"}
ALLOWED_CONTENT_TYPES = {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"}


def repo(request: Request):
    return request.app.state.repo


def user_response(session: dict) -> UserResponse:
    return UserResponse(id=session["user_id"], name=session["name"], email=session["email"], csrf_token=session.get("csrf_token"))


def analysis_response(row: dict) -> AnalysisResponse:
    result = UnifiedAnalysis.model_validate(row["result"]) if row.get("result") else None
    return AnalysisResponse(id=row["id"], project_id=row["project_id"], status=row["status"], stage=row.get("stage"), error=row.get("error"), result=result, created_at=row["created_at"], updated_at=row["updated_at"])


def unavailable(exc: Exception) -> HTTPException:
    return HTTPException(status_code=503, detail=f"Persistence is unavailable: {exc}")


@router.get("/health")
async def health(request: Request):
    configured = bool(settings.database_url) or request.app.state.repo.__class__.__name__ == "MemoryRepository"
    return {"status": "ok", "database_configured": configured, "groq_configured": bool(settings.groq_keys)}


@router.post("/api/auth/signup", response_model=UserResponse, status_code=201)
async def signup(payload: SignupRequest, request: Request, response: Response):
    if not allow_attempt(request, "signup", settings): raise HTTPException(429, "Too many signup attempts; try again later")
    r = repo(request)
    if await r.get_user_by_email(str(payload.email)):
        raise HTTPException(409, "An account with this email already exists")
    try:
        user = await r.create_user(payload.name.strip(), str(payload.email), hash_password(payload.password))
        session_token, csrf = new_token(), new_token()
        await r.create_session(user["id"], token_hash(session_token), csrf, session_expiry(settings))
        response_user = {"user_id": user["id"], "name": user["name"], "email": user["email"], "csrf_token": csrf}
        set_session_cookies(response, request, settings, session_token, csrf)
        return user_response(response_user)
    except HTTPException: raise
    except Exception as exc:
        if "unique" in str(exc).lower(): raise HTTPException(409, "An account with this email already exists")
        raise unavailable(exc)


@router.post("/api/auth/login", response_model=UserResponse)
async def login(payload: LoginRequest, request: Request, response: Response):
    if not allow_attempt(request, "login", settings): raise HTTPException(429, "Too many login attempts; try again later")
    r = repo(request); user = await r.get_user_by_email(str(payload.email))
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    session_token, csrf = new_token(), new_token()
    await r.create_session(user["id"], token_hash(session_token), csrf, session_expiry(settings))
    set_session_cookies(response, request, settings, session_token, csrf)
    return UserResponse(id=user["id"], name=user["name"], email=user["email"], csrf_token=csrf)


@router.post("/api/auth/logout", status_code=204)
async def logout(request: Request, response: Response):
    session = await require_csrf(request, repo(request), settings)
    token = request.cookies.get(settings.cookie_name)
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or invalid")
    await repo(request).delete_session(token_hash(token))
    clear_session_cookies(response, settings)
    response.status_code = 204
    return response


@router.get("/api/auth/me", response_model=UserResponse)
async def me(request: Request):
    return user_response(await current_session(request, repo(request), settings))


@router.patch("/api/auth/me", response_model=UserResponse)
async def update_me(payload: UserProfilePatch, request: Request):
    session = await require_csrf(request, repo(request), settings)
    updated = await repo(request).update_user_name(session["user_id"], payload.name)
    if not updated:
        raise HTTPException(status_code=401, detail="Account is no longer available")
    return user_response({"user_id": updated["id"], "name": updated["name"], "email": updated["email"], "csrf_token": session.get("csrf_token")})


@router.post("/api/auth/csrf", response_model=UserResponse)
async def csrf(request: Request):
    return user_response(await current_session(request, repo(request), settings))


@router.post("/api/auth/password", response_model=UserResponse)
async def change_password(payload: PasswordChangeRequest, request: Request):
    session = await require_csrf(request, repo(request), settings)
    user = await repo(request).get_user_by_email(session["email"])
    if not user or not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(401, "Current password is incorrect")
    await repo(request).update_password(session["user_id"], hash_password(payload.new_password))
    token = request.cookies.get(settings.cookie_name)
    if token: await repo(request).delete_other_sessions(session["user_id"], token_hash(token))
    return user_response(session)


@router.delete("/api/auth/me", status_code=204)
async def delete_account(request: Request, response: Response):
    session = await require_csrf(request, repo(request), settings)
    await repo(request).delete_user(session["user_id"])
    clear_session_cookies(response, settings)
    response.status_code = 204
    return response


async def owned_session(request: Request):
    return await current_session(request, repo(request), settings)


@router.get("/api/projects", response_model=list[ProjectResponse])
async def list_projects(request: Request):
    session = await owned_session(request)
    return await repo(request).list_projects(session["user_id"])


@router.post("/api/projects", response_model=ProjectResponse, status_code=201)
async def create_project(payload: ProjectCreate, request: Request):
    session = await require_csrf(request, repo(request), settings)
    return await repo(request).create_project(session["user_id"], payload.name.strip(), payload.description)


@router.get("/api/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID, request: Request):
    session = await owned_session(request); row = await repo(request).get_project(project_id, session["user_id"])
    if not row: raise HTTPException(404, "Project not found")
    return row


@router.patch("/api/projects/{project_id}", response_model=ProjectResponse)
async def patch_project(project_id: UUID, payload: ProjectPatch, request: Request):
    session = await require_csrf(request, repo(request), settings); row = await repo(request).update_project(project_id, session["user_id"], payload.name, payload.description)
    if not row: raise HTTPException(404, "Project not found")
    return row


@router.delete("/api/projects/{project_id}", status_code=204)
async def delete_project(project_id: UUID, request: Request):
    session = await require_csrf(request, repo(request), settings)
    if not await repo(request).delete_project(project_id, session["user_id"]): raise HTTPException(404, "Project not found")
    return Response(status_code=204)


@router.post("/api/projects/{project_id}/analyze", response_model=AnalysisStartResponse, status_code=202)
async def analyze_project(project_id: UUID, request: Request):
    session = await require_csrf(request, repo(request), settings)
    project = await repo(request).get_project(project_id, session["user_id"])
    if not project: raise HTTPException(404, "Project not found")
    try:
        extracted, filename, content_type, analysis_settings = await _parse_analysis_request(request)
        document = await repo(request).create_document(project_id, filename, content_type, extracted.text, extracted.page_blocks)
        analysis = await repo(request).create_analysis(project_id, document["id"], analysis_settings)
        await repo(request).update_project_status(project_id, "analyzing")
        task = asyncio.create_task(AnalysisPipeline(repo(request), GroqClient(settings)).run(analysis["id"], extracted.text, extracted.page_blocks, analysis_settings))
        request.app.state.tasks.add(task); task.add_done_callback(request.app.state.tasks.discard)
        return {"id": analysis["id"], "status": analysis["status"], "ocr_used": extracted.ocr_used}
    except ValueError as exc: raise HTTPException(422, str(exc))
    except HTTPException: raise
    except Exception as exc: raise unavailable(exc)


async def _parse_analysis_request(request: Request):
    """Parse only server-extracted source documents; never trust client-side parsed text for uploads."""
    header = request.headers.get("content-type", "").lower()
    if header.startswith("multipart/form-data"):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_UPLOAD_BYTES + 512_000:
            raise HTTPException(413, "Uploaded document is too large")
        form = await request.form()
        upload = form.get("file") or form.get("document")
        if not isinstance(upload, StarletteUploadFile):
            raise HTTPException(422, "A PDF, DOCX, or TXT file is required")
        filename = Path(getattr(upload, "filename", "") or "document.txt").name
        content_type = (getattr(upload, "content_type", None) or "application/octet-stream").split(";", 1)[0].lower()
        suffix = Path(filename).suffix.lower()
        if suffix not in ALLOWED_SUFFIXES and content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(422, "Unsupported document type; provide PDF, DOCX, or TXT")
        content = await upload.read(MAX_UPLOAD_BYTES + 1)
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "Uploaded document is too large")
        try:
            extracted = await asyncio.to_thread(extract_document, content, filename, content_type)
        except DocumentExtractionError as exc:
            raise HTTPException(422, str(exc)) from exc
        except Exception as exc:
            raise HTTPException(422, "Could not extract readable text from the uploaded document") from exc
        if not extracted.text.strip():
            raise HTTPException(422, "The uploaded document contains no extractable text")
        if len(extracted.text.encode("utf-8")) > MAX_TEXT_BYTES:
            raise HTTPException(413, "Extracted document text is too large")
        raw_settings = form.get("settings", "{}")
        try:
            raw_settings = json.loads(raw_settings) if isinstance(raw_settings, str) else raw_settings
            if not isinstance(raw_settings, dict): raise ValueError
            raw_settings = {"architecture": raw_settings.get("architecture", raw_settings.get("include_architecture", True)), "cost_estimate": raw_settings.get("cost_estimate", raw_settings.get("include_cost_estimate", True)), "clarification_questions": raw_settings.get("clarification_questions", raw_settings.get("include_clarification_questions", True))}
            analysis_settings = AnalyzeSettings.model_validate(raw_settings).model_dump()
        except (ValueError, TypeError):
            raise HTTPException(422, "settings must be a JSON object")
        return extracted, filename, content_type, analysis_settings
    try:
        payload = AnalyzeRequest.model_validate(await request.json())
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, "Provide JSON with source_text, filename, and content_type") from exc
    if len(payload.source_text.encode("utf-8")) > MAX_TEXT_BYTES:
        raise HTTPException(413, "Pasted text is too large")
    try:
        extracted = await asyncio.to_thread(extract_document, payload.source_text.encode("utf-8"), payload.filename, payload.content_type)
    except DocumentExtractionError as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(422, "Could not extract readable text from the pasted document") from exc
    return extracted, payload.filename, payload.content_type, payload.model_dump(exclude={"source_text", "filename", "content_type"})


@router.get("/api/analyses/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(analysis_id: UUID, request: Request):
    session = await owned_session(request); row = await repo(request).get_analysis(analysis_id, session["user_id"])
    if not row: raise HTTPException(404, "Analysis not found")
    return analysis_response(row)


@router.get("/api/projects/{project_id}/analyses", response_model=list[AnalysisResponse])
async def list_analyses(project_id: UUID, request: Request):
    session = await owned_session(request)
    if not await repo(request).get_project(project_id, session["user_id"]): raise HTTPException(404, "Project not found")
    return [analysis_response(row) for row in await repo(request).list_analyses(project_id, session["user_id"])]


@router.get("/api/overview")
async def overview(request: Request):
    session = await owned_session(request)
    return await repo(request).overview(session["user_id"])


@router.get("/api/analytics")
async def analytics(request: Request):
    session = await owned_session(request)
    return await repo(request).analytics(session["user_id"])


@router.get("/api/analyses/{analysis_id}/status", response_model=AnalysisStatus)
async def analysis_status(analysis_id: UUID, request: Request):
    session = await owned_session(request); row = await repo(request).get_analysis(analysis_id, session["user_id"])
    if not row: raise HTTPException(404, "Analysis not found")
    error = row.get("error")
    if row.get("status") == "failed" and isinstance(error, str) and error.startswith("422 Unprocessable Entity:"):
        raise HTTPException(422, error)
    return {"id": row["id"], "status": row["status"], "stage": row.get("stage"), "error": row.get("error"), "progress_percent": row.get("progress_percent", 0)}


@router.post("/api/analyses/{analysis_id}/regenerate-section", response_model=ProposalResponse)
async def regenerate_section(analysis_id: UUID, payload: RegenerateSectionRequest, request: Request):
    if not payload.confirmed: raise HTTPException(422, "Explicit confirmation is required to replace a section")
    session = await require_csrf(request, repo(request), settings); analysis = await repo(request).get_analysis(analysis_id, session["user_id"])
    if not analysis or analysis.get("status") != "completed": raise HTTPException(404, "Completed analysis not found")
    proposal = await repo(request).get_proposal_for_analysis(analysis_id, session["user_id"])
    if not proposal: raise HTTPException(404, "Proposal not found")
    result = UnifiedAnalysis.model_validate(analysis["result"]); generated = next((s.model_dump(mode="json") for s in result.proposal_outline.sections if s.key == payload.section_key), None)
    if generated is None: raise HTTPException(404, "Proposal section not found")
    sections = [generated if s["key"] == payload.section_key else s for s in proposal["sections"]]
    updated = await repo(request).update_proposal(proposal["id"], session["user_id"], sections)
    return ProposalResponse.model_validate(updated)


@router.get("/api/proposals", response_model=list[ProposalResponse])
async def list_proposals(request: Request):
    session = await owned_session(request)
    return [ProposalResponse.model_validate(row) for row in await repo(request).list_proposals(session["user_id"])]


@router.get("/api/proposals/{proposal_id}", response_model=ProposalResponse)
async def get_proposal(proposal_id: UUID, request: Request):
    session = await owned_session(request); row = await repo(request).get_proposal(proposal_id, session["user_id"])
    if not row: row = await repo(request).get_proposal_for_analysis(proposal_id, session["user_id"])
    if not row: raise HTTPException(404, "Proposal not found")
    return ProposalResponse.model_validate(row)


@router.patch("/api/proposals/{proposal_id}", response_model=ProposalResponse)
async def patch_proposal(proposal_id: UUID, payload: ProposalPatch, request: Request):
    session = await require_csrf(request, repo(request), settings); row = await repo(request).update_proposal(proposal_id, session["user_id"], [s.model_dump(mode="json") for s in payload.sections])
    if not row: raise HTTPException(404, "Proposal not found")
    return ProposalResponse.model_validate(row)


@router.get("/api/proposals/{proposal_id}/export")
async def export_proposal(proposal_id: UUID, format: str, request: Request):
    if format not in {"markdown", "docx", "pdf"}: raise HTTPException(422, "format must be markdown, docx, or pdf")
    session = await owned_session(request); row = await repo(request).get_proposal(proposal_id, session["user_id"])
    if not row: raise HTTPException(404, "Proposal not found")
    if format == "markdown": data, media, filename = markdown(row["sections"]).encode(), "text/markdown", "proposal.md"
    elif format == "docx": data, media, filename = docx_bytes(row["sections"]), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "proposal.docx"
    else: data, media, filename = pdf_bytes(row["sections"]), "application/pdf", "proposal.pdf"
    return StreamingResponse(iter([data]), media_type=media, headers={"Content-Disposition": f'attachment; filename="{filename}"'})
