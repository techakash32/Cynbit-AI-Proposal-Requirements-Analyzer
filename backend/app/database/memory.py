from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4


class MemoryRepository:
    def __init__(self): self.users={}; self.sessions={}; self.projects={}; self.documents={}; self.analyses={}; self.proposals={}
    async def create_user(self,name,email,password_hash):
        if any(u['email']==email.lower() for u in self.users.values()): raise ValueError('duplicate email')
        now=datetime.now(timezone.utc); uid=uuid4(); value={'id':uid,'name':name,'email':email.lower(),'password_hash':password_hash,'created_at':now}; self.users[uid]=value; return value
    async def get_user_by_email(self,email): return next((u for u in self.users.values() if u['email']==email.lower()),None)
    async def get_user(self,user_id): return self.users.get(user_id)
    async def update_user_name(self,user_id,name):
        user=self.users.get(user_id)
        if not user:return None
        user['name']=name; return user
    async def create_session(self,user_id,token_hash,csrf_token,expires_at): self.sessions[token_hash]={'user_id':user_id,'csrf_token':csrf_token,'expires_at':expires_at}
    async def get_session(self,token_hash):
        s=self.sessions.get(token_hash)
        if not s:return None
        u=self.users.get(s['user_id']); return {**s,'name':u['name'],'email':u['email']} if u else None
    async def delete_session(self,token_hash): self.sessions.pop(token_hash,None)
    async def create_project(self,owner_id,name,description):
        now=datetime.now(timezone.utc); pid=uuid4(); p={'id':pid,'owner_id':owner_id,'name':name,'description':description,'status':'draft','created_at':now,'updated_at':now}; self.projects[pid]=p; return p
    def _project_counts(self, project_id):
        completed = [a for a in self.analyses.values() if a['project_id'] == project_id and a['status'] == 'completed' and a.get('result')]
        if not completed: return 0, 0
        result = max(completed, key=lambda item: item['created_at']).get('result') or {}
        return len(result.get('requirements') or []), len(result.get('risks') or [])

    def _project_response(self, project):
        req, risks = self._project_counts(project['id'])
        return {**project, 'requirements_count': req, 'risks_count': risks}

    async def list_projects(self,owner_id): return [self._project_response(p) for p in sorted(self.projects.values(), key=lambda item: item['updated_at'], reverse=True) if p['owner_id']==owner_id]
    async def get_project(self,project_id,owner_id):
        p=self.projects.get(project_id); return self._project_response(p) if p and p['owner_id']==owner_id else None
    async def update_project(self,project_id,owner_id,name,description):
        p=await self.get_project(project_id,owner_id)
        if not p:return None
        if name is not None:p['name']=name
        if description is not None:p['description']=description
        p['updated_at']=datetime.now(timezone.utc); return self._project_response(p)

    async def update_project_status(self,project_id,status):
        if project_id in self.projects:
            self.projects[project_id]['status'] = status
            self.projects[project_id]['updated_at'] = datetime.now(timezone.utc)
    async def delete_project(self,project_id,owner_id):
        p=await self.get_project(project_id,owner_id)
        if not p:return False
        del self.projects[project_id]; return True
    async def create_document(self,project_id,filename,content_type,extracted_text,page_blocks):
        did=uuid4(); d={'id':did,'project_id':project_id,'filename':filename,'content_type':content_type,'extracted_text':extracted_text,'page_blocks':page_blocks}; self.documents[did]=d; return d
    async def create_analysis(self,project_id,document_id,settings):
        now=datetime.now(timezone.utc); aid=uuid4(); a={'id':aid,'project_id':project_id,'document_id':document_id,'status':'queued','stage':'queued','result':None,'error':None,'progress_percent':0,'settings':settings,'created_at':now,'updated_at':now}; self.analyses[aid]=a; return a
    async def update_analysis(self,analysis_id,status,stage=None,result=None,error=None,progress_percent=0):
        if analysis_id in self.analyses: self.analyses[analysis_id].update(status=status,stage=stage,result=result,error=error,progress_percent=progress_percent,updated_at=datetime.now(timezone.utc))
    async def get_analysis_by_id(self,analysis_id): return self.analyses.get(analysis_id)
    async def get_analysis(self,analysis_id,owner_id):
        a=self.analyses.get(analysis_id); p=self.projects.get(a['project_id']) if a else None; return a if a and p and p['owner_id']==owner_id else None
    async def list_analyses(self,project_id,owner_id): return [a for a in self.analyses.values() if a['project_id']==project_id and self.projects.get(project_id,{}).get('owner_id')==owner_id]
    async def create_proposal(self,analysis_id,sections):
        now=datetime.now(timezone.utc); pid=uuid4(); p={'id':pid,'analysis_id':analysis_id,'sections':sections,'created_at':now,'updated_at':now}; self.proposals[pid]=p; return p
    async def get_proposal(self,proposal_id,owner_id):
        p=self.proposals.get(proposal_id); a=self.analyses.get(p['analysis_id']) if p else None; project=self.projects.get(a['project_id']) if a else None; return p if p and project and project['owner_id']==owner_id else None
    async def get_proposal_for_analysis(self,analysis_id,owner_id):
        analysis = self.analyses.get(analysis_id)
        if not analysis: return None
        return next((p for p in self.proposals.values() if p['analysis_id']==analysis_id and self.projects.get(analysis['project_id'],{}).get('owner_id')==owner_id),None)
    async def list_proposals(self,owner_id):
        return sorted([p for p in self.proposals.values() if (a := self.analyses.get(p['analysis_id'])) and self.projects.get(a['project_id'],{}).get('owner_id') == owner_id], key=lambda item: item['updated_at'], reverse=True)
    async def update_proposal(self,proposal_id,owner_id,sections):
        p=await self.get_proposal(proposal_id,owner_id)
        if not p:return None
        p['sections']=sections; p['updated_at']=datetime.now(timezone.utc); return p
    async def get_document(self,analysis_id,owner_id):
        a=await self.get_analysis(analysis_id,owner_id); return self.documents.get(a['document_id']) if a else None

    async def update_password(self,user_id,password_hash):
        if user_id in self.users: self.users[user_id]['password_hash'] = password_hash

    async def delete_other_sessions(self,user_id,current_token_hash):
        self.sessions = {key: value for key, value in self.sessions.items() if value['user_id'] != user_id or key == current_token_hash}

    async def delete_user(self,user_id):
        project_ids = [pid for pid, project in self.projects.items() if project['owner_id'] == user_id]
        analysis_ids = [aid for aid, analysis in self.analyses.items() if analysis['project_id'] in project_ids]
        document_ids = [did for did, document in self.documents.items() if document['project_id'] in project_ids]
        for pid in project_ids: self.projects.pop(pid, None)
        for aid in analysis_ids: self.analyses.pop(aid, None)
        for did in document_ids: self.documents.pop(did, None)
        for pid, proposal in list(self.proposals.items()):
            if proposal['analysis_id'] in analysis_ids: self.proposals.pop(pid, None)
        for key, session in list(self.sessions.items()):
            if session['user_id'] == user_id: self.sessions.pop(key, None)
        self.users.pop(user_id, None)

    def _owned_analysis_rows(self, owner_id):
        rows = []
        for analysis in self.analyses.values():
            project = self.projects.get(analysis['project_id'])
            if project and project['owner_id'] == owner_id:
                rows.append({**analysis, 'name': project['name']})
        return sorted(rows, key=lambda item: item['created_at'], reverse=True)

    async def overview(self, owner_id):
        rows = self._owned_analysis_rows(owner_id); now = datetime.now(timezone.utc); current_start = now - timedelta(days=30); previous_start = now - timedelta(days=60)
        completed = [row for row in rows if row['status'] == 'completed' and row.get('result')]
        def counts(items):
            req = risks = high = 0
            for row in items:
                result = row.get('result') or {}; req += len(result.get('requirements') or []); risk_items = result.get('risks') or []; risks += len(risk_items); high += sum(str(item.get('severity','')).lower() in {'high','critical'} for item in risk_items)
            return req, risks, high
        req, risks, high = counts(completed); current = [row for row in completed if row['created_at'] >= current_start]; previous = [row for row in completed if previous_start <= row['created_at'] < current_start]; cr, cx, _ = counts(current); pr, px, _ = counts(previous)
        recent = []
        for row in rows[:10]:
            result = row.get('result') or {}; recent.append({'id': row['id'], 'name': row['name'], 'status': row['status'], 'requirements_count': len(result.get('requirements') or []) if row['status'] == 'completed' else 0, 'risks_count': len(result.get('risks') or []) if row['status'] == 'completed' else 0, 'created_at': row['created_at'], 'updated_at': row['updated_at']})
        result = {'total_projects': sum(project['owner_id'] == owner_id for project in self.projects.values()), 'analyses_completed': len(completed), 'requirements_extracted': req, 'high_severity_risks': high, 'recent_analyses': recent}
        if rows:
            owned_projects = [project for project in self.projects.values() if project['owner_id'] == owner_id]; current_projects = sum(project['created_at'] >= current_start for project in owned_projects); previous_projects = sum(previous_start <= project['created_at'] < current_start for project in owned_projects)
            result['deltas'] = {'projects': current_projects - previous_projects, 'analyses': len(current) - len(previous), 'requirements': cr - pr, 'risks': cx - px}
        return result

    async def analytics(self, owner_id):
        by_date = {}; by_category = {}; by_severity = {}
        for row in self._owned_analysis_rows(owner_id):
            if row['status'] != 'completed' or not row.get('result'): continue
            by_date[row['created_at'].date().isoformat()] = by_date.get(row['created_at'].date().isoformat(), 0) + 1; result = row['result'] or {}
            for item in result.get('requirements') or []:
                key = item.get('category') or 'uncategorized'; by_category[key] = by_category.get(key, 0) + 1
            for item in result.get('risks') or []:
                key = item.get('severity') or 'unknown'; by_severity[key] = by_severity.get(key, 0) + 1
        return {'analyses_over_time': [{'date': key, 'count': by_date[key]} for key in sorted(by_date)], 'requirements_by_category': [{'category': key, 'count': by_category[key]} for key in sorted(by_category)], 'risk_severity': [{'severity': key, 'count': by_severity[key]} for key in sorted(by_severity)]}
