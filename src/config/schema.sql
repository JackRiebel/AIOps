-- Meraki Dashboard MCP Server Database Schema (PostgreSQL)

-- Clusters table for storing Meraki Dashboard organization credentials
CREATE TABLE IF NOT EXISTS clusters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    url VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    password_encrypted TEXT NOT NULL,
    verify_ssl BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security configuration table
CREATE TABLE IF NOT EXISTS security_config (
    id SERIAL PRIMARY KEY,
    edit_mode_enabled BOOLEAN DEFAULT FALSE,
    allowed_operations TEXT[],
    audit_logging BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- API endpoints mapping table
CREATE TABLE IF NOT EXISTS api_endpoints (
    id SERIAL PRIMARY KEY,
    api_name VARCHAR(50) NOT NULL,
    operation_id VARCHAR(255) NOT NULL,
    http_method VARCHAR(10) NOT NULL,
    path VARCHAR(512) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    requires_edit_mode BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(api_name, operation_id)
);

-- Audit log for tracking all operations
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    cluster_id INTEGER REFERENCES clusters(id) ON DELETE SET NULL,
    user_id VARCHAR(255),
    operation_id VARCHAR(255),
    http_method VARCHAR(10),
    path VARCHAR(512),
    request_body JSONB,
    response_status INTEGER,
    response_body JSONB,
    error_message TEXT,
    client_ip VARCHAR(45),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Chat conversations table (required for foreign key in ai_cost_logs)
CREATE TABLE IF NOT EXISTS chat_conversations (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    organization VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- AI Cost Tracking Table (PostgreSQL compatible - THIS IS THE FIXED ONE)
DROP TABLE IF EXISTS ai_cost_logs CASCADE;
CREATE TABLE ai_cost_logs (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER,
    user_id VARCHAR(255) DEFAULT 'web-user',
    input_tokens BIGINT NOT NULL,
    output_tokens BIGINT NOT NULL,
    total_tokens BIGINT NOT NULL,
    cost_usd NUMERIC(12, 8) NOT NULL,
    model VARCHAR(100) DEFAULT 'claude-3-haiku-20240307',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_cluster_id ON audit_log(cluster_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_operation_id ON audit_log(operation_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_client_ip ON audit_log(client_ip);
CREATE INDEX IF NOT EXISTS idx_api_endpoints_api_name ON api_endpoints(api_name);
CREATE INDEX IF NOT EXISTS idx_api_endpoints_enabled ON api_endpoints(enabled);
CREATE INDEX IF NOT EXISTS idx_ai_cost_logs_timestamp ON ai_cost_logs(timestamp DESC);

-- Default security config
INSERT INTO security_config (edit_mode_enabled, audit_logging)
VALUES (FALSE, TRUE)
ON CONFLICT DO NOTHING;

-- Splunk Log Insights table for AI-generated summary cards
CREATE TABLE IF NOT EXISTS splunk_log_insights (
    id SERIAL PRIMARY KEY,
    organization VARCHAR(255) NOT NULL,
    search_query TEXT,
    time_range VARCHAR(50),
    title VARCHAR(500) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    description TEXT,
    log_count INTEGER DEFAULT 0,
    examples JSONB,
    source_system VARCHAR(50),
    ai_cost NUMERIC(12, 8),
    token_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_splunk_insights_org ON splunk_log_insights(organization);
CREATE INDEX IF NOT EXISTS idx_splunk_insights_severity ON splunk_log_insights(severity);
CREATE INDEX IF NOT EXISTS idx_splunk_insights_created ON splunk_log_insights(created_at DESC);

COMMENT ON TABLE splunk_log_insights IS 'AI-generated summary cards for Splunk logs';

-- Comments
COMMENT ON TABLE clusters IS 'Stores Meraki Dashboard organization connection information with encrypted API keys';
COMMENT ON TABLE security_config IS 'Global security configuration for the MCP server';
COMMENT ON TABLE api_endpoints IS 'Registry of all available API endpoints from OpenAPI specs';
COMMENT ON TABLE audit_log IS 'Audit trail of all operations performed through the MCP server';
COMMENT ON TABLE ai_cost_logs IS 'Tracks cost and usage of Claude AI queries for ROI dashboard';

-- AI Session Tracking Tables
CREATE TABLE IF NOT EXISTS ai_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    ended_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    total_input_tokens BIGINT DEFAULT 0 NOT NULL,
    total_output_tokens BIGINT DEFAULT 0 NOT NULL,
    total_tokens BIGINT DEFAULT 0 NOT NULL,
    total_cost_usd NUMERIC(12, 8) DEFAULT 0 NOT NULL,
    summary_input_tokens BIGINT DEFAULT 0 NOT NULL,
    summary_output_tokens BIGINT DEFAULT 0 NOT NULL,
    summary_cost_usd NUMERIC(12, 8) DEFAULT 0 NOT NULL,
    total_events INTEGER DEFAULT 0 NOT NULL,
    ai_query_count INTEGER DEFAULT 0 NOT NULL,
    api_call_count INTEGER DEFAULT 0 NOT NULL,
    navigation_count INTEGER DEFAULT 0 NOT NULL,
    click_count INTEGER DEFAULT 0 NOT NULL,
    edit_action_count INTEGER DEFAULT 0 NOT NULL,
    error_count INTEGER DEFAULT 0 NOT NULL,
    ai_summary JSONB
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_id ON ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_status ON ai_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_started_at ON ai_sessions(started_at DESC);

CREATE TABLE IF NOT EXISTS ai_session_events (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    event_data JSONB DEFAULT '{}' NOT NULL,
    input_tokens BIGINT,
    output_tokens BIGINT,
    cost_usd NUMERIC(12, 8),
    model VARCHAR(100),
    api_endpoint VARCHAR(512),
    api_method VARCHAR(10),
    api_status INTEGER,
    api_duration_ms INTEGER,
    page_path VARCHAR(512),
    element_id VARCHAR(255),
    element_type VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_ai_session_events_session_id ON ai_session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_session_events_event_type ON ai_session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ai_session_events_timestamp ON ai_session_events(timestamp);

COMMENT ON TABLE ai_sessions IS 'AI session tracking for comprehensive activity logging and cost tracking';
COMMENT ON TABLE ai_session_events IS 'Individual events within AI sessions';

-- ============================================================================
-- A2A (Agent-to-Agent) Protocol Tables
-- ============================================================================

-- A2A Tasks table for task lifecycle management
CREATE TABLE IF NOT EXISTS a2a_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'submitted' CHECK (status IN (
        'submitted', 'working', 'input_required', 'auth_required',
        'completed', 'failed', 'canceled', 'rejected'
    )),
    source_agent_id VARCHAR(255),
    target_agent_id VARCHAR(255),
    message JSONB,
    result JSONB,
    artifacts JSONB DEFAULT '[]',
    context JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_a2a_tasks_status ON a2a_tasks(status);
CREATE INDEX IF NOT EXISTS idx_a2a_tasks_source_agent ON a2a_tasks(source_agent_id);
CREATE INDEX IF NOT EXISTS idx_a2a_tasks_target_agent ON a2a_tasks(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_a2a_tasks_created_at ON a2a_tasks(created_at DESC);

COMMENT ON TABLE a2a_tasks IS 'A2A protocol task tracking with full lifecycle management';

-- A2A Push Notification Configurations
CREATE TABLE IF NOT EXISTS a2a_push_notification_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES a2a_tasks(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    events JSONB NOT NULL DEFAULT '["*"]',
    headers JSONB DEFAULT '{}',
    secret_encrypted TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_a2a_push_configs_task_id ON a2a_push_notification_configs(task_id);
CREATE INDEX IF NOT EXISTS idx_a2a_push_configs_enabled ON a2a_push_notification_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_a2a_push_configs_expires_at ON a2a_push_notification_configs(expires_at);

COMMENT ON TABLE a2a_push_notification_configs IS 'Webhook subscription configurations for A2A push notifications';

-- A2A Push Notification Deliveries
CREATE TABLE IF NOT EXISTS a2a_push_notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID REFERENCES a2a_push_notification_configs(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_progress', 'delivered', 'failed', 'dead_letter'
    )),
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    last_status_code INTEGER,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_a2a_deliveries_config_id ON a2a_push_notification_deliveries(config_id);
CREATE INDEX IF NOT EXISTS idx_a2a_deliveries_status ON a2a_push_notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_a2a_deliveries_next_retry ON a2a_push_notification_deliveries(next_retry_at)
    WHERE status = 'pending' AND next_retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_a2a_deliveries_created_at ON a2a_push_notification_deliveries(created_at DESC);

COMMENT ON TABLE a2a_push_notification_deliveries IS 'Delivery records and attempts for A2A push notifications';

-- A2A Federated Agents registry
CREATE TABLE IF NOT EXISTS a2a_federated_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL UNIQUE,
    agent_card JSONB,
    trust_level VARCHAR(50) DEFAULT 'untrusted' CHECK (trust_level IN (
        'untrusted', 'verified', 'trusted', 'internal'
    )),
    enabled BOOLEAN DEFAULT TRUE,
    is_healthy BOOLEAN DEFAULT TRUE,
    last_health_check TIMESTAMPTZ,
    health_check_failures INTEGER DEFAULT 0,
    capabilities JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_a2a_federated_agents_trust_level ON a2a_federated_agents(trust_level);
CREATE INDEX IF NOT EXISTS idx_a2a_federated_agents_enabled ON a2a_federated_agents(enabled);
CREATE INDEX IF NOT EXISTS idx_a2a_federated_agents_healthy ON a2a_federated_agents(is_healthy);

COMMENT ON TABLE a2a_federated_agents IS 'Registry of external A2A agents for federation';

-- A2A Agent Security Keys
CREATE TABLE IF NOT EXISTS a2a_agent_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(255) NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    private_key_encrypted TEXT,
    key_type VARCHAR(50) DEFAULT 'ed25519',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_a2a_agent_keys_agent_id ON a2a_agent_keys(agent_id);

COMMENT ON TABLE a2a_agent_keys IS 'Cryptographic keys for A2A agent card signing and verification';

-- ============================================================================
-- Enterprise RBAC (Role-Based Access Control) Tables
-- ============================================================================

-- Organizations table for multi-tenancy support
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    slug VARCHAR(100) NOT NULL UNIQUE,
    parent_organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_parent ON organizations(parent_organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_active ON organizations(is_active);

COMMENT ON TABLE organizations IS 'Multi-tenant organizations with hierarchical support';

-- Permissions table - granular permission registry
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    is_system BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_type ON permissions(resource_type);

COMMENT ON TABLE permissions IS 'Granular permission definitions organized by category';

-- Roles table - system and custom roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(name, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_roles_organization ON roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active);
CREATE INDEX IF NOT EXISTS idx_roles_priority ON roles(priority DESC);
CREATE INDEX IF NOT EXISTS idx_roles_system ON roles(is_system);

COMMENT ON TABLE roles IS 'System and custom roles with priority-based hierarchy';

-- Role-Permission mapping table
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

COMMENT ON TABLE role_permissions IS 'Maps permissions to roles';

-- User-Organization membership with role assignment
CREATE TABLE IF NOT EXISTS user_organizations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_primary BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE(user_id, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_user_orgs_user ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_org ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_role ON user_organizations(role_id);
CREATE INDEX IF NOT EXISTS idx_user_orgs_primary ON user_organizations(is_primary) WHERE is_primary = TRUE;

COMMENT ON TABLE user_organizations IS 'User membership in organizations with role assignment';

-- User-specific resource permissions (beyond role-based)
CREATE TABLE IF NOT EXISTS user_resource_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT,
    UNIQUE(user_id, permission_id, resource_type, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_user_resource_perms_user ON user_resource_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_resource_perms_resource ON user_resource_permissions(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_user_resource_perms_expires ON user_resource_permissions(expires_at)
    WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_resource_perms_permission ON user_resource_permissions(permission_id);

COMMENT ON TABLE user_resource_permissions IS 'Direct user permissions on specific resources with optional expiration';

-- Permission audit log - tracks all permission checks
CREATE TABLE IF NOT EXISTS permission_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    permission_code VARCHAR(100),
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    result BOOLEAN,
    reason VARCHAR(255),
    context JSONB,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perm_audit_user ON permission_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_perm_audit_timestamp ON permission_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_perm_audit_action ON permission_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_perm_audit_result ON permission_audit_log(result);
CREATE INDEX IF NOT EXISTS idx_perm_audit_permission ON permission_audit_log(permission_code);
CREATE INDEX IF NOT EXISTS idx_perm_audit_denied ON permission_audit_log(timestamp DESC)
    WHERE result = FALSE;

COMMENT ON TABLE permission_audit_log IS 'Audit trail of all permission checks (granted and denied)';

-- Role change requests - approval workflow
CREATE TABLE IF NOT EXISTS role_change_requests (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    current_role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    requested_role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
    reason TEXT NOT NULL,
    reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_requests_status ON role_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_role_requests_target ON role_change_requests(target_user_id);
CREATE INDEX IF NOT EXISTS idx_role_requests_requester ON role_change_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_role_requests_org ON role_change_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_role_requests_pending ON role_change_requests(created_at DESC)
    WHERE status = 'pending';

COMMENT ON TABLE role_change_requests IS 'Approval workflow for role change requests';

-- User delegations - temporary permission delegation
CREATE TABLE IF NOT EXISTS user_delegations (
    id SERIAL PRIMARY KEY,
    delegator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delegate_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    scope JSONB NOT NULL,
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT different_users CHECK (delegator_id != delegate_id)
);

CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON user_delegations(delegator_id);
CREATE INDEX IF NOT EXISTS idx_delegations_delegate ON user_delegations(delegate_id);
CREATE INDEX IF NOT EXISTS idx_delegations_active ON user_delegations(is_active, ends_at)
    WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_delegations_org ON user_delegations(organization_id);

COMMENT ON TABLE user_delegations IS 'Temporary delegation of permissions between users';

-- Access restrictions - IP/geo/time-based rules
CREATE TABLE IF NOT EXISTS access_restrictions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    restriction_type VARCHAR(50) NOT NULL CHECK (restriction_type IN (
        'ip_whitelist', 'ip_blacklist', 'geo_allow', 'geo_deny', 'time_window'
    )),
    name VARCHAR(255),
    value JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT has_target CHECK (user_id IS NOT NULL OR organization_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_restrictions_user ON access_restrictions(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_restrictions_org ON access_restrictions(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_restrictions_type ON access_restrictions(restriction_type);
CREATE INDEX IF NOT EXISTS idx_restrictions_active ON access_restrictions(is_active);

COMMENT ON TABLE access_restrictions IS 'IP, geographic, and time-based access restrictions';

-- ============================================================================
-- Seed Data: System Permissions
-- ============================================================================

INSERT INTO permissions (code, name, description, category, is_system) VALUES
-- User Management
('users.view', 'View Users', 'View user list and profiles', 'users', TRUE),
('users.create', 'Create Users', 'Create new user accounts', 'users', TRUE),
('users.update', 'Update Users', 'Update user information', 'users', TRUE),
('users.delete', 'Delete Users', 'Delete user accounts', 'users', TRUE),
('users.manage_roles', 'Manage User Roles', 'Assign and modify user roles', 'users', TRUE),
('users.manage_permissions', 'Manage User Permissions', 'Grant/revoke individual permissions', 'users', TRUE),

-- Incident Management
('incidents.view', 'View Incidents', 'View incident list and details', 'incidents', TRUE),
('incidents.create', 'Create Incidents', 'Create new incidents manually', 'incidents', TRUE),
('incidents.update', 'Update Incidents', 'Update incident status and details', 'incidents', TRUE),
('incidents.delete', 'Delete Incidents', 'Delete incidents', 'incidents', TRUE),
('incidents.refresh', 'Refresh Incidents', 'Trigger incident data refresh from sources', 'incidents', TRUE),
('incidents.correlate', 'Correlate Incidents', 'Run AI-powered incident correlation', 'incidents', TRUE),

-- Network Management
('network.view', 'View Networks', 'View network topology, devices, and status', 'network', TRUE),
('network.manage', 'Manage Networks', 'Configure network settings and policies', 'network', TRUE),
('network.devices.view', 'View Devices', 'View device details and status', 'network', TRUE),
('network.devices.manage', 'Manage Devices', 'Configure, reboot, and manage devices', 'network', TRUE),
('network.devices.dangerous', 'Dangerous Device Operations', 'Factory reset, remove devices', 'network', TRUE),

-- AI Features
('ai.chat', 'AI Chat', 'Use AI chat for network queries', 'ai', TRUE),
('ai.chat.write', 'AI Chat Write Operations', 'Use AI chat for write operations', 'ai', TRUE),
('ai.settings', 'AI Settings', 'Configure AI preferences and models', 'ai', TRUE),
('ai.costs.view', 'View AI Costs', 'View AI usage statistics and costs', 'ai', TRUE),
('ai.knowledge.view', 'View Knowledge Base', 'Search and view knowledge base documents', 'ai', TRUE),
('ai.knowledge.manage', 'Manage Knowledge Base', 'Upload, edit, and delete documents', 'ai', TRUE),
('ai.sessions.view', 'View AI Sessions', 'View AI session history', 'ai', TRUE),
('ai.sessions.manage', 'Manage AI Sessions', 'Delete or export AI sessions', 'ai', TRUE),

-- Audit
('audit.view', 'View Audit Logs', 'View audit log entries', 'audit', TRUE),
('audit.export', 'Export Audit Logs', 'Export audit logs to file', 'audit', TRUE),
('audit.permissions.view', 'View Permission Audit', 'View permission check audit trail', 'audit', TRUE),

-- Admin/System
('admin.system.view', 'View System Config', 'View system configuration', 'admin', TRUE),
('admin.system.manage', 'Manage System Config', 'Modify system configuration', 'admin', TRUE),
('admin.security.view', 'View Security Config', 'View security settings', 'admin', TRUE),
('admin.security.manage', 'Manage Security Config', 'Modify security settings', 'admin', TRUE),
('admin.edit_mode', 'Toggle Edit Mode', 'Enable/disable global edit mode', 'admin', TRUE),
('admin.organizations.view', 'View Organizations', 'View all organizations', 'admin', TRUE),
('admin.organizations.manage', 'Manage Organizations', 'Create, update, delete organizations', 'admin', TRUE),

-- RBAC Management
('rbac.roles.view', 'View Roles', 'View role definitions and permissions', 'rbac', TRUE),
('rbac.roles.manage', 'Manage Roles', 'Create, update, delete custom roles', 'rbac', TRUE),
('rbac.permissions.view', 'View Permissions', 'View permission definitions', 'rbac', TRUE),
('rbac.delegations.view', 'View Delegations', 'View permission delegations', 'rbac', TRUE),
('rbac.delegations.manage', 'Manage Delegations', 'Create and revoke delegations', 'rbac', TRUE),
('rbac.requests.view', 'View Role Requests', 'View role change requests', 'rbac', TRUE),
('rbac.requests.manage', 'Manage Role Requests', 'Approve or reject role requests', 'rbac', TRUE),
('rbac.restrictions.view', 'View Access Restrictions', 'View IP/geo/time restrictions', 'rbac', TRUE),
('rbac.restrictions.manage', 'Manage Access Restrictions', 'Create and manage access restrictions', 'rbac', TRUE),

-- Integrations
('integrations.view', 'View Integrations', 'View configured integrations', 'integrations', TRUE),
('integrations.manage', 'Manage Integrations', 'Add, remove, configure integrations', 'integrations', TRUE),
('integrations.meraki', 'Access Meraki', 'View and manage Meraki networks', 'integrations', TRUE),
('integrations.meraki.write', 'Meraki Write Operations', 'Perform write operations on Meraki', 'integrations', TRUE),
('integrations.catalyst', 'Access Catalyst Center', 'View and manage Catalyst networks', 'integrations', TRUE),
('integrations.catalyst.write', 'Catalyst Write Operations', 'Perform write operations on Catalyst', 'integrations', TRUE),
('integrations.splunk', 'Access Splunk', 'View and query Splunk logs', 'integrations', TRUE),
('integrations.thousandeyes', 'Access ThousandEyes', 'View ThousandEyes monitoring data', 'integrations', TRUE),
('integrations.thousandeyes.write', 'ThousandEyes Write Operations', 'Create/modify ThousandEyes tests', 'integrations', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- Seed Data: System Roles with Permission Mappings
-- ============================================================================

-- Insert system roles (organization_id = NULL means global)
INSERT INTO roles (name, display_name, description, is_system, priority) VALUES
('super_admin', 'Super Administrator', 'Full system access across all organizations', TRUE, 1000),
('admin', 'Administrator', 'Full access within organization', TRUE, 100),
('editor', 'Editor', 'Read/write access to most resources', TRUE, 50),
('operator', 'Operator', 'Limited write access, can trigger operations', TRUE, 25),
('viewer', 'Viewer', 'Read-only access to all data', TRUE, 10)
ON CONFLICT DO NOTHING;

-- Map all permissions to super_admin (has everything)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Map permissions to admin (everything except super_admin-only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
  AND p.code NOT IN ('admin.organizations.manage')
ON CONFLICT DO NOTHING;

-- Map permissions to editor (read/write but no admin functions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'editor'
  AND p.code IN (
    'users.view',
    'incidents.view', 'incidents.create', 'incidents.update', 'incidents.refresh', 'incidents.correlate',
    'network.view', 'network.manage', 'network.devices.view', 'network.devices.manage',
    'ai.chat', 'ai.chat.write', 'ai.settings', 'ai.costs.view', 'ai.knowledge.view', 'ai.knowledge.manage', 'ai.sessions.view',
    'audit.view',
    'rbac.roles.view', 'rbac.permissions.view', 'rbac.delegations.view', 'rbac.requests.view',
    'integrations.view', 'integrations.meraki', 'integrations.meraki.write',
    'integrations.catalyst', 'integrations.catalyst.write',
    'integrations.splunk', 'integrations.thousandeyes', 'integrations.thousandeyes.write'
  )
ON CONFLICT DO NOTHING;

-- Map permissions to operator (read + limited write operations)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'operator'
  AND p.code IN (
    'users.view',
    'incidents.view', 'incidents.update', 'incidents.refresh',
    'network.view', 'network.devices.view',
    'ai.chat', 'ai.costs.view', 'ai.knowledge.view', 'ai.sessions.view',
    'audit.view',
    'rbac.roles.view', 'rbac.permissions.view',
    'integrations.view', 'integrations.meraki', 'integrations.catalyst',
    'integrations.splunk', 'integrations.thousandeyes'
  )
ON CONFLICT DO NOTHING;

-- Map permissions to viewer (read-only everything)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer'
  AND p.code IN (
    'users.view',
    'incidents.view',
    'network.view', 'network.devices.view',
    'ai.chat', 'ai.costs.view', 'ai.knowledge.view', 'ai.sessions.view',
    'audit.view',
    'rbac.roles.view', 'rbac.permissions.view',
    'integrations.view', 'integrations.meraki', 'integrations.catalyst',
    'integrations.splunk', 'integrations.thousandeyes'
  )
ON CONFLICT DO NOTHING;

-- Create default organization for existing data
INSERT INTO organizations (name, display_name, slug, is_active)
VALUES ('Default', 'Default Organization', 'default', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- AI-Enabled Workflows Tables
-- ============================================================================

-- Workflows table - automation workflow definitions
CREATE TABLE IF NOT EXISTS workflows (
    id SERIAL PRIMARY KEY,

    -- Basic info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('active', 'paused', 'draft')),

    -- Trigger configuration
    trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('splunk_query', 'schedule', 'manual')),
    splunk_query TEXT,  -- SPL query for splunk_query trigger
    schedule_cron VARCHAR(100),  -- Cron expression for schedule trigger
    poll_interval_seconds INTEGER NOT NULL DEFAULT 300,  -- Polling interval

    -- Conditions - evaluated against Splunk results
    -- Format: [{"field": "severity", "operator": "equals", "value": "critical"}, ...]
    conditions JSONB,

    -- Actions to execute when triggered
    -- Format: [{"tool": "meraki_reboot_device", "params": {}, "requires_approval": true}, ...]
    actions JSONB,

    -- AI configuration
    ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ai_prompt TEXT,  -- Custom instructions for AI analysis
    ai_confidence_threshold FLOAT NOT NULL DEFAULT 0.7,  -- Min confidence to recommend

    -- Flow builder data (for visual editor)
    -- Stores React Flow nodes/edges for advanced workflows
    flow_data JSONB,

    -- Ownership & Organization
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    organization VARCHAR(255),

    -- Template info (if created from template)
    template_id VARCHAR(100),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_triggered_at TIMESTAMPTZ,

    -- Stats
    trigger_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflows_organization ON workflows(organization);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger_type ON workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);
CREATE INDEX IF NOT EXISTS idx_workflows_template_id ON workflows(template_id);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(status) WHERE status = 'active';

COMMENT ON TABLE workflows IS 'AI-enabled automation workflow definitions';

-- ============================================================================
-- Workflows Table Migration - Add Missing Columns (January 2026)
-- ============================================================================

-- Add workflow_mode column for Cards/CLI/Python modes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workflows' AND column_name = 'workflow_mode'
    ) THEN
        ALTER TABLE workflows ADD COLUMN workflow_mode VARCHAR(20) DEFAULT 'cards' NOT NULL;
        COMMENT ON COLUMN workflows.workflow_mode IS 'Workflow creation mode: cards, cli, or python';
    END IF;
END $$;

-- Add auto_execute_enabled column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workflows' AND column_name = 'auto_execute_enabled'
    ) THEN
        ALTER TABLE workflows ADD COLUMN auto_execute_enabled BOOLEAN DEFAULT FALSE NOT NULL;
        COMMENT ON COLUMN workflows.auto_execute_enabled IS 'Enable automatic execution without approval';
    END IF;
END $$;

-- Add auto_execute_min_confidence column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workflows' AND column_name = 'auto_execute_min_confidence'
    ) THEN
        ALTER TABLE workflows ADD COLUMN auto_execute_min_confidence FLOAT DEFAULT 0.9 NOT NULL;
        COMMENT ON COLUMN workflows.auto_execute_min_confidence IS 'Minimum AI confidence for auto-execution (0.0-1.0)';
    END IF;
END $$;

-- Add auto_execute_max_risk column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workflows' AND column_name = 'auto_execute_max_risk'
    ) THEN
        ALTER TABLE workflows ADD COLUMN auto_execute_max_risk VARCHAR(10) DEFAULT 'low' NOT NULL;
        COMMENT ON COLUMN workflows.auto_execute_max_risk IS 'Maximum risk level for auto-execution: low, medium, high';
    END IF;
END $$;

-- Add cli_code column for CLI mode workflows
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workflows' AND column_name = 'cli_code'
    ) THEN
        ALTER TABLE workflows ADD COLUMN cli_code TEXT;
        COMMENT ON COLUMN workflows.cli_code IS 'CLI-style script content for CLI mode workflows';
    END IF;
END $$;

-- Add python_code column for Python mode workflows
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workflows' AND column_name = 'python_code'
    ) THEN
        ALTER TABLE workflows ADD COLUMN python_code TEXT;
        COMMENT ON COLUMN workflows.python_code IS 'Python code content for Python mode workflows';
    END IF;
END $$;

-- Add tags column for workflow categorization
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workflows' AND column_name = 'tags'
    ) THEN
        ALTER TABLE workflows ADD COLUMN tags TEXT[];
        COMMENT ON COLUMN workflows.tags IS 'Tags for workflow categorization and search';
    END IF;
END $$;

-- Create index on workflow_mode for filtering
CREATE INDEX IF NOT EXISTS idx_workflows_mode ON workflows(workflow_mode);

-- Create index on tags for search (GIN for array containment)
CREATE INDEX IF NOT EXISTS idx_workflows_tags ON workflows USING gin(tags) WHERE tags IS NOT NULL;

-- Workflow executions table - individual execution instances
CREATE TABLE IF NOT EXISTS workflow_executions (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending_approval' CHECK (status IN (
        'pending_approval', 'approved', 'rejected', 'executing', 'completed', 'failed'
    )),

    -- Trigger data - what caused this execution
    trigger_data JSONB,  -- Splunk events or other trigger context
    trigger_event_count INTEGER NOT NULL DEFAULT 0,

    -- AI analysis results
    ai_analysis TEXT,  -- AI's reasoning/explanation
    ai_confidence FLOAT,  -- 0.0 - 1.0
    ai_risk_level VARCHAR(10) CHECK (ai_risk_level IN ('low', 'medium', 'high')),

    -- Recommended actions from AI
    -- Format: [{"action": "tool_name", "params": {...}, "reason": "why"}, ...]
    recommended_actions JSONB,

    -- Approval tracking
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Execution results
    executed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    result JSONB,  -- Results from action execution
    error TEXT,  -- Error message if failed

    -- Actions executed (may differ from recommended if user modified)
    executed_actions JSONB,

    -- Cost tracking
    ai_cost_usd FLOAT NOT NULL DEFAULT 0.0,
    ai_input_tokens INTEGER NOT NULL DEFAULT 0,
    ai_output_tokens INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_at ON workflow_executions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_approved_by ON workflow_executions(approved_by);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_pending ON workflow_executions(created_at DESC)
    WHERE status = 'pending_approval';

COMMENT ON TABLE workflow_executions IS 'Individual execution instances of workflows';

-- Workflow outcomes table - track whether executions resolved issues
CREATE TABLE IF NOT EXISTS workflow_outcomes (
    id SERIAL PRIMARY KEY,
    execution_id INTEGER NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,

    -- Outcome classification
    outcome VARCHAR(50) NOT NULL DEFAULT 'unknown',  -- 'resolved', 'partial', 'failed', 'unknown'

    -- Resolution details
    resolution_time_minutes INTEGER,  -- Time from execution to resolution

    -- User feedback
    notes TEXT,

    -- Tags for categorization
    tags TEXT[],  -- e.g., ['network', 'performance', 'quick-fix']

    -- Metrics
    affected_devices_count INTEGER,
    affected_users_count INTEGER,

    -- Learning data
    root_cause TEXT,  -- Optional root cause analysis
    prevention_notes TEXT,  -- Notes on how to prevent in future

    -- Who recorded the outcome
    recorded_by INTEGER REFERENCES users(id),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_outcomes_execution_id ON workflow_outcomes(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_outcomes_outcome ON workflow_outcomes(outcome);
CREATE INDEX IF NOT EXISTS idx_workflow_outcomes_created_at ON workflow_outcomes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_outcomes_recorded_by ON workflow_outcomes(recorded_by);

COMMENT ON TABLE workflow_outcomes IS 'Track outcomes of workflow executions for learning and improvement';

-- Add workflow outcome permissions
INSERT INTO permissions (code, name, description, category, is_system) VALUES
('workflows.record_outcome', 'Record Workflow Outcomes', 'Record outcomes for workflow executions', 'workflows', TRUE)
ON CONFLICT (code) DO NOTHING;

-- All roles except viewer can record outcomes
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name IN ('admin', 'editor', 'operator') AND p.code = 'workflows.record_outcome'
ON CONFLICT DO NOTHING;

-- Add workflow permissions
INSERT INTO permissions (code, name, description, category, is_system) VALUES
('workflows.view', 'View Workflows', 'View workflow definitions and executions', 'workflows', TRUE),
('workflows.create', 'Create Workflows', 'Create new workflows', 'workflows', TRUE),
('workflows.edit', 'Edit Workflows', 'Modify existing workflows', 'workflows', TRUE),
('workflows.delete', 'Delete Workflows', 'Delete workflows', 'workflows', TRUE),
('workflows.approve', 'Approve Workflow Actions', 'Approve or reject pending workflow actions', 'workflows', TRUE),
('workflows.execute', 'Execute Workflows', 'Manually trigger workflow execution', 'workflows', TRUE),
('workflows.admin', 'Workflow Administration', 'Full workflow administration access', 'workflows', TRUE)
ON CONFLICT (code) DO NOTHING;

-- Map workflow permissions to roles
-- Admin gets all workflow permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code LIKE 'workflows.%'
ON CONFLICT DO NOTHING;

-- Editor gets view, create, edit, execute
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'editor' AND p.code IN (
    'workflows.view', 'workflows.create', 'workflows.edit', 'workflows.execute'
)
ON CONFLICT DO NOTHING;

-- Operator gets view, approve, execute
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'operator' AND p.code IN (
    'workflows.view', 'workflows.approve', 'workflows.execute'
)
ON CONFLICT DO NOTHING;

-- Viewer gets view only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer' AND p.code = 'workflows.view'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Incident Network-Specific Fields Migration
-- ============================================================================

-- Add network-specific fields to incidents table (if exists)
DO $$
BEGIN
    -- Add network_id column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'incidents' AND column_name = 'network_id'
    ) THEN
        ALTER TABLE incidents ADD COLUMN network_id VARCHAR(255);
        CREATE INDEX IF NOT EXISTS idx_incidents_network_id ON incidents(network_id);
    END IF;

    -- Add network_name column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'incidents' AND column_name = 'network_name'
    ) THEN
        ALTER TABLE incidents ADD COLUMN network_name VARCHAR(500);
    END IF;

    -- Add device_config column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'incidents' AND column_name = 'device_config'
    ) THEN
        ALTER TABLE incidents ADD COLUMN device_config JSONB;
    END IF;
END $$;

COMMENT ON COLUMN incidents.network_id IS 'Meraki network ID - incidents are now network-specific';
COMMENT ON COLUMN incidents.network_name IS 'Human-readable network name for display';
COMMENT ON COLUMN incidents.device_config IS 'Relevant device configuration for incident context';

-- ============================================================================
-- AI Session ROI Tracking Migration
-- ============================================================================

-- Add ROI tracking columns to ai_sessions table
DO $$
BEGIN
    -- Time saved calculation
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_sessions' AND column_name = 'time_saved_minutes'
    ) THEN
        ALTER TABLE ai_sessions ADD COLUMN time_saved_minutes NUMERIC(10, 2);
    END IF;

    -- ROI percentage
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_sessions' AND column_name = 'roi_percentage'
    ) THEN
        ALTER TABLE ai_sessions ADD COLUMN roi_percentage NUMERIC(10, 2);
    END IF;

    -- Manual cost estimate
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_sessions' AND column_name = 'manual_cost_estimate_usd'
    ) THEN
        ALTER TABLE ai_sessions ADD COLUMN manual_cost_estimate_usd NUMERIC(12, 4);
    END IF;

    -- Session categorization
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_sessions' AND column_name = 'session_type'
    ) THEN
        ALTER TABLE ai_sessions ADD COLUMN session_type VARCHAR(50);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_sessions' AND column_name = 'complexity_score'
    ) THEN
        ALTER TABLE ai_sessions ADD COLUMN complexity_score INTEGER;
    END IF;

    -- Performance metrics
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_sessions' AND column_name = 'avg_response_time_ms'
    ) THEN
        ALTER TABLE ai_sessions ADD COLUMN avg_response_time_ms INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_sessions' AND column_name = 'slowest_query_ms'
    ) THEN
        ALTER TABLE ai_sessions ADD COLUMN slowest_query_ms INTEGER;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_sessions' AND column_name = 'total_duration_ms'
    ) THEN
        ALTER TABLE ai_sessions ADD COLUMN total_duration_ms BIGINT;
    END IF;

    -- Cost breakdown
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_sessions' AND column_name = 'cost_breakdown'
    ) THEN
        ALTER TABLE ai_sessions ADD COLUMN cost_breakdown JSONB;
    END IF;

    -- Incident correlation
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_sessions' AND column_name = 'incident_id'
    ) THEN
        ALTER TABLE ai_sessions ADD COLUMN incident_id INTEGER REFERENCES incidents(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_ai_sessions_incident_id ON ai_sessions(incident_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_sessions' AND column_name = 'incident_resolved'
    ) THEN
        ALTER TABLE ai_sessions ADD COLUMN incident_resolved BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_sessions' AND column_name = 'resolution_time_minutes'
    ) THEN
        ALTER TABLE ai_sessions ADD COLUMN resolution_time_minutes NUMERIC(10, 2);
    END IF;

    -- Efficiency score
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_sessions' AND column_name = 'efficiency_score'
    ) THEN
        ALTER TABLE ai_sessions ADD COLUMN efficiency_score INTEGER;
    END IF;
END $$;

-- Add ROI tracking columns to ai_session_events table
DO $$
BEGIN
    -- Duration tracking
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_session_events' AND column_name = 'duration_ms'
    ) THEN
        ALTER TABLE ai_session_events ADD COLUMN duration_ms INTEGER;
    END IF;

    -- Action classification
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_session_events' AND column_name = 'action_type'
    ) THEN
        ALTER TABLE ai_session_events ADD COLUMN action_type VARCHAR(50);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_session_events' AND column_name = 'baseline_minutes'
    ) THEN
        ALTER TABLE ai_session_events ADD COLUMN baseline_minutes NUMERIC(10, 2);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_session_events' AND column_name = 'time_saved_minutes'
    ) THEN
        ALTER TABLE ai_session_events ADD COLUMN time_saved_minutes NUMERIC(10, 2);
    END IF;
END $$;

-- Create indexes for ROI queries
CREATE INDEX IF NOT EXISTS idx_ai_sessions_session_type ON ai_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_roi_percentage ON ai_sessions(roi_percentage DESC);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_time_saved ON ai_sessions(time_saved_minutes DESC);
CREATE INDEX IF NOT EXISTS idx_ai_session_events_action_type ON ai_session_events(action_type);

COMMENT ON COLUMN ai_sessions.time_saved_minutes IS 'Calculated time saved vs manual operations (sum of event baselines)';
COMMENT ON COLUMN ai_sessions.roi_percentage IS 'Return on investment: ((manual_cost - ai_cost) / ai_cost) * 100';
COMMENT ON COLUMN ai_sessions.manual_cost_estimate_usd IS 'Estimated cost if done manually (time_saved * hourly_rate)';
COMMENT ON COLUMN ai_sessions.session_type IS 'Categorization: incident_response, investigation, configuration, optimization, monitoring';
COMMENT ON COLUMN ai_sessions.complexity_score IS '1-5 score based on number and type of actions';
COMMENT ON COLUMN ai_sessions.cost_breakdown IS 'JSON breakdown of costs by category: ai_queries, enrichment, summary';
COMMENT ON COLUMN ai_sessions.incident_id IS 'Link to incident resolved during this session (MTTR tracking)';
COMMENT ON COLUMN ai_sessions.efficiency_score IS '0-100 composite efficiency score';

-- ============================================================================
-- Knowledge Graph Tables
-- ============================================================================

-- Knowledge entities - named entities extracted from documents
CREATE TABLE IF NOT EXISTS knowledge_entities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    description TEXT,
    aliases JSONB DEFAULT '[]',
    properties JSONB DEFAULT '{}',
    source_count INTEGER DEFAULT 1,
    embedding VECTOR(384),  -- e5-small-v2 local embedding (384 dimensions)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(normalized_name, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_entities_type ON knowledge_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_normalized_name ON knowledge_entities(normalized_name);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_source_count ON knowledge_entities(source_count DESC);

COMMENT ON TABLE knowledge_entities IS 'Named entities (devices, protocols, products, concepts) in the knowledge graph';

-- Knowledge relationships - connections between entities
CREATE TABLE IF NOT EXISTS knowledge_relationships (
    id SERIAL PRIMARY KEY,
    source_entity_id INTEGER NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
    target_entity_id INTEGER NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
    relationship_type VARCHAR(50) NOT NULL,
    confidence FLOAT DEFAULT 1.0,
    weight FLOAT DEFAULT 1.0,
    properties JSONB DEFAULT '{}',
    source_chunk_id INTEGER REFERENCES knowledge_chunks(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_entity_id, target_entity_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_source ON knowledge_relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_target ON knowledge_relationships(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_type ON knowledge_relationships(relationship_type);

COMMENT ON TABLE knowledge_relationships IS 'Semantic relationships between entities (requires, uses, configures, etc.)';

-- Entity-chunk mentions - tracks where entities appear in chunks
CREATE TABLE IF NOT EXISTS entity_chunk_mentions (
    id SERIAL PRIMARY KEY,
    entity_id INTEGER NOT NULL REFERENCES knowledge_entities(id) ON DELETE CASCADE,
    chunk_id INTEGER NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
    mention_count INTEGER DEFAULT 1,
    mention_positions JSONB DEFAULT '[]',
    context_snippet TEXT,
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_id, chunk_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_chunk_mentions_entity ON entity_chunk_mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_chunk_mentions_chunk ON entity_chunk_mentions(chunk_id);

COMMENT ON TABLE entity_chunk_mentions IS 'Tracks entity mentions in knowledge chunks for graph-enhanced retrieval';

-- Chunk cross-references - links between related chunks
CREATE TABLE IF NOT EXISTS chunk_references (
    id SERIAL PRIMARY KEY,
    source_chunk_id INTEGER NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
    target_chunk_id INTEGER NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE,
    reference_type VARCHAR(50) DEFAULT 'see_also',
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_chunk_id, target_chunk_id)
);

CREATE INDEX IF NOT EXISTS idx_chunk_references_source ON chunk_references(source_chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunk_references_target ON chunk_references(target_chunk_id);

COMMENT ON TABLE chunk_references IS 'Cross-references between chunks for multi-hop retrieval';

-- ============================================================================
-- Knowledge Feedback & Query Logging Tables
-- ============================================================================

-- Query logs - tracks all knowledge queries for analytics
CREATE TABLE IF NOT EXISTS knowledge_query_logs (
    id SERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    query_embedding_hash VARCHAR(64),
    intent VARCHAR(50),
    expanded_queries TEXT[],
    entities_extracted JSONB DEFAULT '[]',
    retrieval_strategy VARCHAR(50) DEFAULT 'hybrid',
    retrieved_chunk_ids INTEGER[],
    chunk_scores JSONB,
    graph_entities_used INTEGER[],
    graph_hops INTEGER,
    response_generated TEXT,
    response_model VARCHAR(100),
    citations JSONB,
    embedding_latency_ms INTEGER,
    retrieval_latency_ms INTEGER,
    reranking_latency_ms INTEGER,
    generation_latency_ms INTEGER,
    total_latency_ms INTEGER,
    had_feedback BOOLEAN DEFAULT FALSE,
    feedback_positive BOOLEAN,
    result_count INTEGER,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    source VARCHAR(50) DEFAULT 'search',
    filters JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_logs_user ON knowledge_query_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_query_logs_source ON knowledge_query_logs(source);
CREATE INDEX IF NOT EXISTS idx_query_logs_strategy ON knowledge_query_logs(retrieval_strategy);
CREATE INDEX IF NOT EXISTS idx_query_logs_intent ON knowledge_query_logs(intent);
CREATE INDEX IF NOT EXISTS idx_query_logs_had_feedback ON knowledge_query_logs(had_feedback);
CREATE INDEX IF NOT EXISTS idx_query_logs_created ON knowledge_query_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_logs_latency ON knowledge_query_logs(total_latency_ms);
CREATE INDEX IF NOT EXISTS idx_query_logs_embedding_hash ON knowledge_query_logs(query_embedding_hash);

COMMENT ON TABLE knowledge_query_logs IS 'Log of all knowledge queries for analytics, performance monitoring, and improvement';

-- User feedback on knowledge results
CREATE TABLE IF NOT EXISTS knowledge_feedback (
    id SERIAL PRIMARY KEY,
    query_log_id INTEGER REFERENCES knowledge_query_logs(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    chunk_ids INTEGER[],
    response_text TEXT,
    feedback_type VARCHAR(20) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    is_positive BOOLEAN,
    comment TEXT,
    issues JSONB DEFAULT '[]',
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    clicked_chunks INTEGER[] DEFAULT '{}',
    time_on_result_ms INTEGER,
    follow_up_query TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_type ON knowledge_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_user ON knowledge_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_positive ON knowledge_feedback(is_positive);
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_created ON knowledge_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_query_log ON knowledge_feedback(query_log_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_feedback_rating ON knowledge_feedback(rating) WHERE rating IS NOT NULL;

COMMENT ON TABLE knowledge_feedback IS 'User feedback on knowledge search results and AI answers';

-- Aggregated chunk feedback stats for retrieval boosting
CREATE TABLE IF NOT EXISTS chunk_feedback_stats (
    id SERIAL PRIMARY KEY,
    chunk_id INTEGER NOT NULL REFERENCES knowledge_chunks(id) ON DELETE CASCADE UNIQUE,
    positive_count INTEGER DEFAULT 0,
    negative_count INTEGER DEFAULT 0,
    report_count INTEGER DEFAULT 0,
    helpfulness_score FLOAT DEFAULT 0.5,
    click_through_rate FLOAT,
    avg_time_on_result_ms INTEGER,
    retrieval_count INTEGER DEFAULT 0,
    top_3_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chunk_stats_helpfulness ON chunk_feedback_stats(helpfulness_score DESC);
CREATE INDEX IF NOT EXISTS idx_chunk_stats_retrieval ON chunk_feedback_stats(retrieval_count DESC);

COMMENT ON TABLE chunk_feedback_stats IS 'Aggregated feedback statistics per chunk for retrieval boosting';

-- ============================================================================
-- Performance Optimization Indexes
-- ============================================================================

-- IVFFlat index for faster approximate nearest neighbor search on chunk embeddings
-- Note: Requires pgvector extension and > 1000 rows for optimal performance
-- lists = sqrt(num_rows) is a good starting point, adjust based on data size
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) THEN
        -- Drop existing btree index if it exists (can't use for vector search)
        DROP INDEX IF EXISTS idx_knowledge_chunks_embedding;

        -- Create IVFFlat index for cosine similarity
        -- This provides ~10x faster queries at slight accuracy cost
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_ivfflat
            ON knowledge_chunks
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)';

        -- Also create index for entity embeddings
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_entities_embedding_ivfflat
            ON knowledge_entities
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 50)';

        RAISE NOTICE 'Created IVFFlat indexes for vector search';
    END IF;
END $$;

-- GIN index for full-text search on chunk content
-- Enables fast keyword search using tsvector
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_content_fts
    ON knowledge_chunks
    USING gin(to_tsvector('english', content));

-- GIN index for document title search
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_title_fts
    ON knowledge_documents
    USING gin(to_tsvector('english', title));

-- Composite index for filtered searches (doc_type + created_at)
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_type_created
    ON knowledge_documents(doc_type, created_at DESC);

-- Composite index for chunk lookups by document
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc_position
    ON knowledge_chunks(document_id, chunk_index);

-- Index for finding chunks by relevance score (for pre-computed scores)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_metadata_gin
    ON knowledge_chunks
    USING gin(metadata jsonb_path_ops);

-- Partial index for active/valid documents only
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_active
    ON knowledge_documents(created_at DESC)
    WHERE status = 'active';

-- Index for entity lookups by type and name
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_type_name
    ON knowledge_entities(entity_type, normalized_name);

-- Index for relationship traversal (common pattern: find all relationships for entity)
CREATE INDEX IF NOT EXISTS idx_knowledge_relationships_entities
    ON knowledge_relationships(source_entity_id, target_entity_id, relationship_type);

-- Index for query log analytics (time-based queries)
CREATE INDEX IF NOT EXISTS idx_query_logs_analytics
    ON knowledge_query_logs(created_at DESC, retrieval_strategy, result_count);

-- Partial index for queries needing attention (no results or negative feedback)
CREATE INDEX IF NOT EXISTS idx_query_logs_problematic
    ON knowledge_query_logs(created_at DESC)
    WHERE result_count = 0 OR feedback_positive = FALSE;

COMMENT ON INDEX idx_knowledge_chunks_content_fts IS 'Full-text search index for keyword queries';
COMMENT ON INDEX idx_knowledge_documents_type_created IS 'Optimized for filtered document listings';

-- ============================================================================
-- Agentic RAG Configuration
-- ============================================================================

-- Insert default agentic RAG configuration values
INSERT INTO system_configs (key, value, description, category) VALUES
('agentic_rag_enabled', 'false', 'Enable agentic RAG pipeline for enhanced knowledge retrieval', 'ai'),
('agentic_rag_max_iterations', '2', 'Maximum reflection/iteration cycles for quality improvement', 'ai'),
('agentic_rag_timeout', '15', 'Total timeout in seconds for agentic RAG pipeline', 'ai'),
('agentic_rag_query_analysis', 'true', 'Enable query decomposition and analysis agent', 'ai'),
('agentic_rag_document_grading', 'true', 'Enable LLM-based document relevance grading', 'ai'),
('agentic_rag_reflection', 'true', 'Enable self-reflection and quality assessment', 'ai'),
('agentic_rag_web_search', 'false', 'Enable web search fallback when KB coverage is insufficient', 'ai'),
('agentic_rag_debug', 'false', 'Enable verbose debug logging for agentic RAG', 'ai')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE system_configs IS 'System-wide configuration including AI and agentic RAG settings';

-- ============================================================================
-- Adaptive Retrieval & Query Classification Migration
-- ============================================================================

-- Add query classification and retrieval metrics columns to knowledge_queries
DO $$
BEGIN
    -- Add query_classification column for storing classification metadata
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_queries' AND column_name = 'query_classification'
    ) THEN
        ALTER TABLE knowledge_queries ADD COLUMN query_classification JSONB DEFAULT '{}';
        COMMENT ON COLUMN knowledge_queries.query_classification IS 'Query classification: intent, complexity, detected products/doc_types';
    END IF;

    -- Add retrieval_metrics column for observability
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_queries' AND column_name = 'retrieval_metrics'
    ) THEN
        ALTER TABLE knowledge_queries ADD COLUMN retrieval_metrics JSONB DEFAULT '{}';
        COMMENT ON COLUMN knowledge_queries.retrieval_metrics IS 'Retrieval pipeline metrics: candidates, diversity, quality scores';
    END IF;
END $$;

-- Add indexes for query classification analytics
CREATE INDEX IF NOT EXISTS idx_knowledge_queries_intent
    ON knowledge_queries((query_classification->>'intent'))
    WHERE query_classification IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_queries_complexity
    ON knowledge_queries((query_classification->>'complexity'))
    WHERE query_classification IS NOT NULL;

-- ============================================================================
-- Chunk-Level Feedback Loop Migration (Sprint 2)
-- ============================================================================

-- Add resolution outcome columns to chunk_feedback_stats
DO $$
BEGIN
    -- Add resolution_count column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chunk_feedback_stats' AND column_name = 'resolution_count'
    ) THEN
        ALTER TABLE chunk_feedback_stats ADD COLUMN resolution_count INTEGER DEFAULT 0;
        COMMENT ON COLUMN chunk_feedback_stats.resolution_count IS 'Times chunk led to full resolution';
    END IF;

    -- Add partial_count column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chunk_feedback_stats' AND column_name = 'partial_count'
    ) THEN
        ALTER TABLE chunk_feedback_stats ADD COLUMN partial_count INTEGER DEFAULT 0;
        COMMENT ON COLUMN chunk_feedback_stats.partial_count IS 'Times chunk was partially helpful';
    END IF;

    -- Add incorrect_count column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chunk_feedback_stats' AND column_name = 'incorrect_count'
    ) THEN
        ALTER TABLE chunk_feedback_stats ADD COLUMN incorrect_count INTEGER DEFAULT 0;
        COMMENT ON COLUMN chunk_feedback_stats.incorrect_count IS 'Times chunk led to wrong direction';
    END IF;

    -- Add resolution_rate column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'chunk_feedback_stats' AND column_name = 'resolution_rate'
    ) THEN
        ALTER TABLE chunk_feedback_stats ADD COLUMN resolution_rate FLOAT;
        COMMENT ON COLUMN chunk_feedback_stats.resolution_rate IS 'resolution_count / total_outcomes';
    END IF;
END $$;

-- Add index for resolution rate
CREATE INDEX IF NOT EXISTS idx_chunk_stats_resolution_rate
    ON chunk_feedback_stats(resolution_rate DESC)
    WHERE resolution_rate IS NOT NULL;

-- ============================================================================
-- Parent-Child Chunk Retrieval Migration (Sprint 3)
-- ============================================================================

-- Add parent_chunk_id and hierarchy_level columns to knowledge_chunks
DO $$
BEGIN
    -- Add parent_chunk_id column for hierarchical relationships
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_chunks' AND column_name = 'parent_chunk_id'
    ) THEN
        ALTER TABLE knowledge_chunks ADD COLUMN parent_chunk_id INTEGER REFERENCES knowledge_chunks(id) ON DELETE SET NULL;
        COMMENT ON COLUMN knowledge_chunks.parent_chunk_id IS 'Parent chunk for hierarchical context retrieval';
    END IF;

    -- Add hierarchy_level column (0=section, 1=subsection, 2=paragraph)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'knowledge_chunks' AND column_name = 'hierarchy_level'
    ) THEN
        ALTER TABLE knowledge_chunks ADD COLUMN hierarchy_level INTEGER DEFAULT 2;
        COMMENT ON COLUMN knowledge_chunks.hierarchy_level IS 'Chunk hierarchy: 0=section, 1=subsection, 2=paragraph';
    END IF;
END $$;

-- Add indexes for parent-child relationships
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_parent
    ON knowledge_chunks(parent_chunk_id)
    WHERE parent_chunk_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_hierarchy
    ON knowledge_chunks(document_id, hierarchy_level);

-- Index for finding siblings (same parent)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_siblings
    ON knowledge_chunks(parent_chunk_id, chunk_index)
    WHERE parent_chunk_id IS NOT NULL;

-- ============================================================================
-- AI Response Feedback for Continuous Learning (Lumen AI Canvas Phase 1)
-- ============================================================================

-- AI response feedback - tracks user feedback on AI chat responses
CREATE TABLE IF NOT EXISTS ai_response_feedback (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255),
    message_id VARCHAR(255) NOT NULL,
    chat_session_id VARCHAR(255),  -- Links to chat session persistence
    feedback_type VARCHAR(20) NOT NULL CHECK (feedback_type IN ('positive', 'negative')),
    feedback_text TEXT,
    feedback_categories TEXT[],  -- e.g., ['inaccurate', 'incomplete', 'slow']
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    model VARCHAR(100),
    query TEXT,  -- The user's original query
    response_preview TEXT,  -- First 500 chars of AI response
    tools_used TEXT[],  -- Tools involved in generating the response
    latency_ms INTEGER,  -- Response time
    token_count INTEGER,  -- Total tokens used
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_response_feedback_session ON ai_response_feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_response_feedback_type ON ai_response_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_ai_response_feedback_user ON ai_response_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_response_feedback_created ON ai_response_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_response_feedback_negative ON ai_response_feedback(created_at DESC)
    WHERE feedback_type = 'negative';

COMMENT ON TABLE ai_response_feedback IS 'User feedback on AI chat responses for continuous learning (Lumen AI Canvas)';

-- ============================================================================
-- Saved Canvas States for Persistence (Lumen AI Canvas Phase 1)
-- ============================================================================

-- Saved canvas configurations - allows users to save and restore canvas states
CREATE TABLE IF NOT EXISTS saved_canvases (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    canvas_state JSONB NOT NULL,  -- Full canvas state: cards, positions, config
    thumbnail_url TEXT,  -- Optional preview thumbnail
    is_template BOOLEAN DEFAULT FALSE,  -- Can be used as a template by others
    is_public BOOLEAN DEFAULT FALSE,  -- Publicly accessible via share link
    share_token VARCHAR(64) UNIQUE,  -- UUID for public sharing
    share_password_hash VARCHAR(255),  -- Optional password protection
    share_expires_at TIMESTAMPTZ,  -- Optional expiration for shared links
    tags TEXT[],  -- Tags for organization/search
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_canvases_user ON saved_canvases(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_canvases_org ON saved_canvases(organization_id);
CREATE INDEX IF NOT EXISTS idx_saved_canvases_share_token ON saved_canvases(share_token)
    WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_saved_canvases_public ON saved_canvases(is_public)
    WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_saved_canvases_template ON saved_canvases(is_template)
    WHERE is_template = TRUE;
CREATE INDEX IF NOT EXISTS idx_saved_canvases_updated ON saved_canvases(updated_at DESC);

COMMENT ON TABLE saved_canvases IS 'Saved canvas states for persistence and sharing (Lumen AI Canvas)';