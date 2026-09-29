CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at VARCHAR(19) NOT NULL);
CREATE TABLE clients (
 id VARCHAR(24) PRIMARY KEY, name VARCHAR(120) NOT NULL, email VARCHAR(254) NOT NULL,
 company VARCHAR(120) NOT NULL, notes TEXT NOT NULL, created_at VARCHAR(19) NOT NULL
);
CREATE TABLE users (
 id VARCHAR(24) PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL, role VARCHAR(16) NOT NULL, client_id VARCHAR(24) NULL,
 active INTEGER NOT NULL DEFAULT 1, demo_role VARCHAR(16) NULL, created_at VARCHAR(19) NOT NULL,
 FOREIGN KEY (client_id) REFERENCES clients(id)
);
CREATE TABLE projects (
 id VARCHAR(24) PRIMARY KEY, code VARCHAR(16) NOT NULL UNIQUE, client_id VARCHAR(24) NOT NULL,
 title VARCHAR(160) NOT NULL, description TEXT NOT NULL, status VARCHAR(16) NOT NULL,
 due_date VARCHAR(10) NULL, budget_minutes INTEGER NOT NULL, color VARCHAR(16) NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, created_at VARCHAR(19) NOT NULL, updated_at VARCHAR(19) NOT NULL,
 FOREIGN KEY (client_id) REFERENCES clients(id)
);
CREATE TABLE project_members (
 project_id VARCHAR(24) NOT NULL, user_id VARCHAR(24) NOT NULL,
 PRIMARY KEY(project_id,user_id), FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE requests (
 id VARCHAR(24) PRIMARY KEY, client_id VARCHAR(24) NOT NULL, author_id VARCHAR(24) NOT NULL,
 title VARCHAR(160) NOT NULL, description TEXT NOT NULL, priority VARCHAR(16) NOT NULL,
 status VARCHAR(16) NOT NULL, project_id VARCHAR(24) NULL UNIQUE, version INTEGER NOT NULL DEFAULT 1,
 created_at VARCHAR(19) NOT NULL, updated_at VARCHAR(19) NOT NULL,
 FOREIGN KEY(client_id) REFERENCES clients(id), FOREIGN KEY(author_id) REFERENCES users(id), FOREIGN KEY(project_id) REFERENCES projects(id)
);
CREATE TABLE tasks (
 id VARCHAR(24) PRIMARY KEY, project_id VARCHAR(24) NOT NULL, title VARCHAR(160) NOT NULL,
 description TEXT NOT NULL, status VARCHAR(16) NOT NULL, priority VARCHAR(16) NOT NULL,
 assignee_id VARCHAR(24) NULL, due_date VARCHAR(10) NULL, estimate_minutes INTEGER NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, created_at VARCHAR(19) NOT NULL, updated_at VARCHAR(19) NOT NULL,
 FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(assignee_id) REFERENCES users(id)
);
CREATE TABLE comments (
 id VARCHAR(24) PRIMARY KEY, task_id VARCHAR(24) NOT NULL, user_id VARCHAR(24) NOT NULL,
 body TEXT NOT NULL, created_at VARCHAR(19) NOT NULL,
 FOREIGN KEY(task_id) REFERENCES tasks(id), FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE time_entries (
 id VARCHAR(24) PRIMARY KEY, project_id VARCHAR(24) NOT NULL, task_id VARCHAR(24) NULL,
 user_id VARCHAR(24) NOT NULL, minutes INTEGER NOT NULL, work_date VARCHAR(10) NOT NULL,
 note VARCHAR(500) NOT NULL, created_at VARCHAR(19) NOT NULL,
 FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(task_id) REFERENCES tasks(id), FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE deliverables (
 id VARCHAR(24) PRIMARY KEY, project_id VARCHAR(24) NOT NULL, user_id VARCHAR(24) NOT NULL,
 title VARCHAR(160) NOT NULL, filename VARCHAR(64) NOT NULL, original_name VARCHAR(200) NOT NULL,
 mime VARCHAR(100) NOT NULL, bytes INTEGER NOT NULL, revision INTEGER NOT NULL,
 status VARCHAR(16) NOT NULL, feedback TEXT NOT NULL, reviewer_id VARCHAR(24) NULL,
 version INTEGER NOT NULL DEFAULT 1, created_at VARCHAR(19) NOT NULL, updated_at VARCHAR(19) NOT NULL,
 UNIQUE(project_id,revision), FOREIGN KEY(project_id) REFERENCES projects(id),
 FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(reviewer_id) REFERENCES users(id)
);
CREATE TABLE events (
 id VARCHAR(24) PRIMARY KEY, project_id VARCHAR(24) NOT NULL, user_id VARCHAR(24) NOT NULL,
 verb VARCHAR(40) NOT NULL, detail TEXT NOT NULL, created_at VARCHAR(19) NOT NULL,
 FOREIGN KEY(project_id) REFERENCES projects(id), FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE login_attempts (
 id VARCHAR(24) PRIMARY KEY, ip_hash VARCHAR(64) NOT NULL, created_at VARCHAR(19) NOT NULL
);
CREATE INDEX idx_tasks_project_status ON tasks(project_id,status);
CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_members_user ON project_members(user_id);
CREATE INDEX idx_requests_client ON requests(client_id,status);
CREATE INDEX idx_time_project_date ON time_entries(project_id,work_date);
CREATE INDEX idx_comments_task ON comments(task_id,created_at);
CREATE INDEX idx_events_project ON events(project_id,created_at);
CREATE INDEX idx_login_hash ON login_attempts(ip_hash,created_at);
