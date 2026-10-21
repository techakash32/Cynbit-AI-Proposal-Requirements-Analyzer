from __future__ import annotations

import asyncio
import json
from uuid import UUID

import httpx
import pytest

from app.database.memory import MemoryRepository
from app.main import create_app


@pytest.mark.asyncio
async def test_empty_aggregates_and_multipart_upload(monkeypatch):
    repo = MemoryRepository()
    app = create_app(repo)

    async def no_op_run(self, analysis_id, document, page_blocks, settings):
        return None

    monkeypatch.setattr("app.api.routes.AnalysisPipeline.run", no_op_run)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost") as client:
        signup = await client.post("/api/auth/signup", json={"name": "Upload User", "email": "upload@example.com", "password": "correct horse battery staple"})
        csrf = signup.json()["csrf_token"]
        assert (await client.get("/api/overview")).json() == {"total_projects": 0, "analyses_completed": 0, "requirements_extracted": 0, "high_severity_risks": 0, "recent_analyses": []}
        assert (await client.get("/api/analytics")).json() == {"analyses_over_time": [], "requirements_by_category": [], "risk_severity": []}
        project = await client.post("/api/projects", headers={"X-CSRF-Token": csrf}, json={"name": "Upload project"})
        project_id = project.json()["id"]
        response = await client.post(
            f"/api/projects/{project_id}/analyze",
            headers={"X-CSRF-Token": csrf},
            files={"file": ("brief.txt", b"A server extracted requirement.", "text/plain")},
            data={"settings": json.dumps({"include_architecture": False, "include_cost_estimate": True, "include_clarification_questions": False})},
        )
        assert response.status_code == 202
        analysis = repo.analyses[UUID(response.json()["id"])]
        assert analysis["settings"] == {"architecture": False, "cost_estimate": True, "clarification_questions": False}
        assert repo.documents[analysis["document_id"]]["extracted_text"] == "A server extracted requirement."


@pytest.mark.asyncio
async def test_owned_aggregates_and_proposal_lookup_by_analysis_id():
    repo = MemoryRepository()
    app = create_app(repo)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost") as client:
        signup = await client.post("/api/auth/signup", json={"name": "Owner", "email": "owner@example.com", "password": "correct horse battery staple"})
        csrf = signup.json()["csrf_token"]
        project = await client.post("/api/projects", headers={"X-CSRF-Token": csrf}, json={"name": "Owned"})
        project_id = UUID(project.json()["id"])
        document = await repo.create_document(project_id, "brief.txt", "text/plain", "source", [])
        analysis = await repo.create_analysis(project_id, document["id"], {})
        await repo.update_analysis(analysis["id"], "completed", "complete", result={"requirements": [{"id": "R1", "category": "functional"}], "risks": [{"severity": "high"}]}, progress_percent=100)
        await repo.update_project_status(project_id, "completed")
        proposal = await repo.create_proposal(analysis["id"], [{"key": str(index), "heading": "Section", "content": "Draft", "metadata": "ai-draft"} for index in range(17)])
        project_response = await client.get(f"/api/projects/{project_id}")
        assert project_response.json()["requirements_count"] == 1
        assert project_response.json()["risks_count"] == 1
        overview = (await client.get("/api/overview")).json()
        assert overview["analyses_completed"] == 1
        assert overview["high_severity_risks"] == 1
        assert (await client.get("/api/proposals")).json()[0]["id"] == str(proposal["id"])
        assert (await client.get(f"/api/proposals/{analysis['id']}")).status_code == 200


@pytest.mark.asyncio
async def test_password_change_and_account_delete_require_csrf():
    app = create_app(MemoryRepository())
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost") as client:
        signup = await client.post("/api/auth/signup", json={"name": "Security", "email": "security@example.com", "password": "correct horse battery staple"})
        csrf = signup.json()["csrf_token"]
        assert (await client.post("/api/auth/password", json={"current_password": "correct horse battery staple", "new_password": "new correct horse battery staple"})).status_code == 403
        changed = await client.post("/api/auth/password", headers={"X-CSRF-Token": csrf}, json={"current_password": "correct horse battery staple", "new_password": "new correct horse battery staple"})
        assert changed.status_code == 200
        deleted = await client.delete("/api/auth/me", headers={"X-CSRF-Token": csrf})
        assert deleted.status_code == 204
        assert not app.state.repo.users


@pytest.mark.asyncio
async def test_profile_name_update_requires_csrf_and_preserves_read_only_email():
    app = create_app(MemoryRepository())
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost") as client:
        signup = await client.post("/api/auth/signup", json={"name": "Initial Name", "email": "profile@example.com", "password": "correct horse battery staple"})
        csrf = signup.json()["csrf_token"]
        assert (await client.patch("/api/auth/me", json={"name": "Updated Name"})).status_code == 403
        updated = await client.patch("/api/auth/me", headers={"X-CSRF-Token": csrf}, json={"name": "  Updated Name  "})
        assert updated.status_code == 200
        assert updated.json()["name"] == "Updated Name"
        assert updated.json()["email"] == "profile@example.com"
        assert (await client.get("/api/auth/me")).json()["name"] == "Updated Name"
        assert (await client.patch("/api/auth/me", headers={"X-CSRF-Token": csrf}, json={"name": "   "})).status_code == 422
        assert (await client.patch("/api/auth/me", headers={"X-CSRF-Token": csrf}, json={"name": "Other", "email": "other@example.com"})).status_code == 422


@pytest.mark.asyncio
async def test_persistent_schema_failure_returns_422_from_analysis_status():
    repo = MemoryRepository()
    app = create_app(repo)
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://localhost") as client:
        signup = await client.post("/api/auth/signup", json={"name": "Schema Failure", "email": "schema@example.com", "password": "correct horse battery staple"})
        csrf = signup.json()["csrf_token"]
        project = await client.post("/api/projects", headers={"X-CSRF-Token": csrf}, json={"name": "Schema project"})
        project_id = UUID(project.json()["id"])
        document = await repo.create_document(project_id, "brief.txt", "text/plain", "A source requirement.", [{"page": 1, "text": "A source requirement."}])
        analysis = await repo.create_analysis(project_id, document["id"], {})
        await repo.update_analysis(analysis["id"], "failed", "terminal_error", error="422 Unprocessable Entity: Groq stage requirements returned invalid output after 2 attempts", progress_percent=100)

        response = await client.get(f"/api/analyses/{analysis['id']}/status")

        assert response.status_code == 422
        assert "returned invalid output after 2 attempts" in response.json()["detail"]
