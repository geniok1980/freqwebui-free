-- API tokens schema (scoped access tokens для людей и агентов)
-- Idempotent: safe to run on existing or fresh databases.

CREATE TABLE IF NOT EXISTS public.api_tokens (
    id            UUID PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    token_hash    VARCHAR(64) NOT NULL UNIQUE,
    token_prefix  VARCHAR(16) NOT NULL,
    scopes        VARCHAR(50) NOT NULL DEFAULT 'read',
    created_by    VARCHAR(50) NOT NULL,
    tenant_id     VARCHAR(36),
    tenant_slug   VARCHAR(100),
    tenant_schema VARCHAR(100),
    last_used_at  TIMESTAMP,
    revoked       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_hash ON public.api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_api_tokens_tenant ON public.api_tokens(tenant_id);
