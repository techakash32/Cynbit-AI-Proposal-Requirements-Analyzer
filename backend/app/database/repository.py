from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import asyncpg


def _decode_json_fields(row: Any, *field_names: str) -> dict[str, Any]:
    """Decode asyncpg's default JSON/JSONB text representation in selected columns."""
    decoded = dict(row)
    for field_name in field_names:
        value = decoded.get(field_name)
        if isinstance(value, str):
            try:
                decoded[field_name] = json.loads(value)
            except json.JSONDecodeError:
                # Keep malformed legacy data visible rather than silently replacing it.
                pass
    return decoded


class PostgresRepository:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if not self.database_url:
            raise RuntimeError("DATABASE_URL is not configured; PostgreSQL is required")
        self.pool = await asyncpg.create_pool(self.database_url, min_size=1, max_size=5, command_timeout=30)

    async def close(self) -> None:
        if self.pool:
            await self.pool.close()
            self.pool = None

    def _pool(self) -> asyncpg.Pool:
        if not self.pool:
            raise RuntimeError("Database pool is not initialized")
        return self.pool

    async def create_user(self, name: str, email: str, password_hash: str) -> dict[str, Any]:
        row = await self._pool().fetchrow(
            "INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING id,name,email,created_at",
            name, email.lower(), password_hash,
        )
        return dict(row)

    async def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        row = await self._pool().fetchrow(
            "SELECT id,name,email,password_hash FROM users WHERE email=$1", email.lower(),
        )
        return dict(row) if row else None

    async def get_user(self, user_id: UUID) -> dict[str, Any] | None:
        row = await self._pool().fetchrow("SELECT id,name,email FROM users WHERE id=$1", user_id)
        return dict(row) if row else None

    async def update_user_name(self, user_id: UUID, name: str) -> dict[str, Any] | None:
        row = await self._pool().fetchrow(
            "UPDATE users SET name=$2 WHERE id=$1 RETURNING id,name,email", user_id, name,
        )
        return dict(row) if row else None

    async def create_session(self, user_id: UUID, token_hash: str, csrf_token: str, expires_at: datetime) -> None:
        await self._pool().execute(
            "INSERT INTO sessions (user_id,token_hash,csrf_token,expires_at) VALUES ($1,$2,$3,$4)",
            user_id, token_hash, csrf_token, expires_at,
        )

    async def get_session(self, token_hash: str) -> dict[str, Any] | None:
        row = await self._pool().fetchrow(
            "SELECT s.user_id,s.csrf_token,s.expires_at,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1",
            token_hash,
        )
        return dict(row) if row else None

    async def delete_session(self, token_hash: str) -> None:
        await self._pool().execute("DELETE FROM sessions WHERE token_hash=$1", token_hash)

    async def update_password(self, user_id: UUID, password_hash: str) -> None:
        await self._pool().execute("UPDATE users SET password_hash=$2 WHERE id=$1", user_id, password_hash)

    async def delete_other_sessions(self, user_id: UUID, current_token_hash: str) -> None:
        await self._pool().execute("DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2", user_id, current_token_hash)

    async def delete_user(self, user_id: UUID) -> None:
        await self._pool().execute("DELETE FROM users WHERE id=$1", user_id)

    _PROJECT_SELECT = """
        SELECT p.*,
          COALESCE((SELECT jsonb_array_length(a.result->'requirements') FROM analyses a
                    WHERE a.project_id=p.id AND a.status='completed' AND a.result ? 'requirements'
                    ORDER BY a.created_at DESC LIMIT 1), 0) AS requirements_count,
          COALESCE((SELECT jsonb_array_length(a.result->'risks') FROM analyses a
                    WHERE a.project_id=p.id AND a.status='completed' AND a.result ? 'risks'
                    ORDER BY a.created_at DESC LIMIT 1), 0) AS risks_count
        FROM projects p
    """

    async def create_project(self, owner_id: UUID, name: str, description: str | None) -> dict[str, Any]:
        row = await self._pool().fetchrow(
            "INSERT INTO projects (owner_id,name,description) VALUES ($1,$2,$3) RETURNING *",
            owner_id, name, description,
        )
        return {**dict(row), "requirements_count": 0, "risks_count": 0}

    async def list_projects(self, owner_id: UUID) -> list[dict[str, Any]]:
        rows = await self._pool().fetch(
            self._PROJECT_SELECT + " WHERE p.owner_id=$1 ORDER BY p.updated_at DESC", owner_id,
        )
        return [dict(row) for row in rows]

    async def get_project(self, project_id: UUID, owner_id: UUID) -> dict[str, Any] | None:
        row = await self._pool().fetchrow(
            self._PROJECT_SELECT + " WHERE p.id=$1 AND p.owner_id=$2", project_id, owner_id,
        )
        return dict(row) if row else None

    async def update_project(self, project_id: UUID, owner_id: UUID, name: str | None, description: str | None) -> dict[str, Any] | None:
        row = await self._pool().fetchrow(
            "UPDATE projects SET name=COALESCE($3,name),description=COALESCE($4,description),updated_at=now() WHERE id=$1 AND owner_id=$2 RETURNING *",
            project_id, owner_id, name, description,
        )
        if not row:
            return None
        return await self.get_project(project_id, owner_id)

    async def update_project_status(self, project_id: UUID, status: str) -> None:
        await self._pool().execute("UPDATE projects SET status=$2,updated_at=now() WHERE id=$1", project_id, status)

    async def delete_project(self, project_id: UUID, owner_id: UUID) -> bool:
        result = await self._pool().execute("DELETE FROM projects WHERE id=$1 AND owner_id=$2", project_id, owner_id)
        return result.endswith("1")

    async def create_document(self, project_id, filename, content_type, extracted_text, page_blocks):
        row = await self._pool().fetchrow(
            "INSERT INTO documents (project_id,filename,content_type,extracted_text,page_blocks) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *",
            project_id, filename, content_type, extracted_text, json.dumps(page_blocks),
        )
        return _decode_json_fields(row, "page_blocks")

    async def create_analysis(self, project_id, document_id, settings):
        row = await self._pool().fetchrow(
            "INSERT INTO analyses (project_id,document_id,status,stage,settings) VALUES ($1,$2,'queued','queued',$3::jsonb) RETURNING *",
            project_id, document_id, json.dumps(settings),
        )
        return _decode_json_fields(row, "settings", "result")

    async def update_analysis(self, analysis_id, status, stage=None, result=None, error=None, progress_percent=0):
        await self._pool().execute(
            "UPDATE analyses SET status=$2,stage=$3,result=$4::jsonb,error=$5,progress_percent=$6,updated_at=now() WHERE id=$1",
            analysis_id, status, stage, json.dumps(result) if result is not None else None, error, progress_percent,
        )

    async def get_analysis_by_id(self, analysis_id):
        row = await self._pool().fetchrow("SELECT * FROM analyses WHERE id=$1", analysis_id)
        return _decode_json_fields(row, "settings", "result") if row else None

    async def get_analysis(self, analysis_id, owner_id):
        row = await self._pool().fetchrow(
            "SELECT a.* FROM analyses a JOIN projects p ON p.id=a.project_id WHERE a.id=$1 AND p.owner_id=$2",
            analysis_id, owner_id,
        )
        return _decode_json_fields(row, "settings", "result") if row else None

    async def list_analyses(self, project_id, owner_id):
        rows = await self._pool().fetch(
            "SELECT a.* FROM analyses a JOIN projects p ON p.id=a.project_id WHERE a.project_id=$1 AND p.owner_id=$2 ORDER BY a.created_at DESC",
            project_id, owner_id,
        )
        return [_decode_json_fields(row, "settings", "result") for row in rows]

    async def create_proposal(self, analysis_id, sections):
        row = await self._pool().fetchrow(
            "INSERT INTO proposals (analysis_id,sections) VALUES ($1,$2::jsonb) RETURNING *",
            analysis_id, json.dumps(sections),
        )
        return _decode_json_fields(row, "sections")

    async def get_proposal(self, proposal_id, owner_id):
        row = await self._pool().fetchrow(
            "SELECT pr.* FROM proposals pr JOIN analyses a ON a.id=pr.analysis_id JOIN projects p ON p.id=a.project_id WHERE pr.id=$1 AND p.owner_id=$2",
            proposal_id, owner_id,
        )
        return _decode_json_fields(row, "sections") if row else None

    async def get_proposal_for_analysis(self, analysis_id, owner_id):
        row = await self._pool().fetchrow(
            "SELECT pr.* FROM proposals pr JOIN analyses a ON a.id=pr.analysis_id JOIN projects p ON p.id=a.project_id WHERE pr.analysis_id=$1 AND p.owner_id=$2",
            analysis_id, owner_id,
        )
        return _decode_json_fields(row, "sections") if row else None

    async def list_proposals(self, owner_id):
        rows = await self._pool().fetch(
            "SELECT pr.* FROM proposals pr JOIN analyses a ON a.id=pr.analysis_id JOIN projects p ON p.id=a.project_id WHERE p.owner_id=$1 ORDER BY pr.updated_at DESC",
            owner_id,
        )
        return [_decode_json_fields(row, "sections") for row in rows]

    async def update_proposal(self, proposal_id, owner_id, sections):
        row = await self._pool().fetchrow(
            "UPDATE proposals pr SET sections=$3::jsonb,updated_at=now() FROM analyses a JOIN projects p ON p.id=a.project_id WHERE pr.id=$1 AND p.owner_id=$2 RETURNING pr.*",
            proposal_id, owner_id, json.dumps(sections),
        )
        return _decode_json_fields(row, "sections") if row else None

    async def get_document(self, analysis_id, owner_id):
        row = await self._pool().fetchrow(
            "SELECT d.* FROM documents d JOIN analyses a ON a.document_id=d.id JOIN projects p ON p.id=a.project_id WHERE a.id=$1 AND p.owner_id=$2",
            analysis_id, owner_id,
        )
        return _decode_json_fields(row, "page_blocks") if row else None

    async def _owned_analysis_rows(self, owner_id):
        rows = await self._pool().fetch(
            "SELECT a.id,a.project_id,a.status,a.result,a.created_at,a.updated_at,p.name FROM analyses a JOIN projects p ON p.id=a.project_id WHERE p.owner_id=$1 ORDER BY a.created_at DESC",
            owner_id,
        )
        return [_decode_json_fields(row, "result") for row in rows]

    async def overview(self, owner_id):
        rows = await self._owned_analysis_rows(owner_id)
        projects = await self._pool().fetchval("SELECT count(*) FROM projects WHERE owner_id=$1", owner_id)
        now = datetime.now(timezone.utc)
        current_start = now - timedelta(days=30)
        previous_start = now - timedelta(days=60)
        completed = [row for row in rows if row["status"] == "completed" and row.get("result")]

        def counts(items):
            req = risks = high = 0
            for row in items:
                result = row.get("result") or {}
                req += len(result.get("requirements") or [])
                risk_items = result.get("risks") or []
                risks += len(risk_items)
                high += sum(str(item.get("severity", "")).lower() in {"high", "critical"} for item in risk_items)
            return req, risks, high

        req, risks, high = counts(completed)
        current = [row for row in completed if row["created_at"] >= current_start]
        previous = [row for row in completed if previous_start <= row["created_at"] < current_start]
        cr, cx, _ = counts(current)
        pr, px, _ = counts(previous)
        recent = []
        for row in rows[:10]:
            result = row.get("result") or {}
            recent.append({
                "id": row["id"], "name": row["name"], "status": row["status"],
                "requirements_count": len(result.get("requirements") or []) if row["status"] == "completed" else 0,
                "risks_count": len(result.get("risks") or []) if row["status"] == "completed" else 0,
                "created_at": row["created_at"], "updated_at": row["updated_at"],
            })
        result = {
            "total_projects": int(projects or 0), "analyses_completed": len(completed),
            "requirements_extracted": req, "high_severity_risks": high, "recent_analyses": recent,
        }
        if rows:
            project_rows = await self._pool().fetch("SELECT created_at FROM projects WHERE owner_id=$1", owner_id)
            current_projects = sum(row["created_at"] >= current_start for row in project_rows)
            previous_projects = sum(previous_start <= row["created_at"] < current_start for row in project_rows)
            result["deltas"] = {
                "projects": current_projects - previous_projects, "analyses": len(current) - len(previous),
                "requirements": cr - pr, "risks": cx - px,
            }
        return result

    async def analytics(self, owner_id):
        rows = await self._owned_analysis_rows(owner_id)
        by_date = {}
        by_category = {}
        by_severity = {}
        for row in rows:
            if row["status"] != "completed" or not row.get("result"):
                continue
            date = row["created_at"].date().isoformat()
            by_date[date] = by_date.get(date, 0) + 1
            result = row["result"] or {}
            for item in result.get("requirements") or []:
                key = item.get("category") or "uncategorized"
                by_category[key] = by_category.get(key, 0) + 1
            for item in result.get("risks") or []:
                key = item.get("severity") or "unknown"
                by_severity[key] = by_severity.get(key, 0) + 1
        return {
            "analyses_over_time": [{"date": key, "count": by_date[key]} for key in sorted(by_date)],
            "requirements_by_category": [{"category": key, "count": by_category[key]} for key in sorted(by_category)],
            "risk_severity": [{"severity": key, "count": by_severity[key]} for key in sorted(by_severity)],
        }
