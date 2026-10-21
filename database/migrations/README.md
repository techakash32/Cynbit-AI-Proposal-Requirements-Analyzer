# Database migrations

Migration files use increasing, zero-padded sequence numbers and are applied manually in order. For a fresh Neon database, apply `001_initial_schema.sql` in the Neon SQL Editor. The repository-root `database/schema.sql` is the current schema snapshot and currently matches migration 001. The API does not automatically apply migrations at startup, and no migration-tracking/runner service is configured.

For future schema changes, add a new forward-only numbered SQL migration, apply it explicitly to the target database, and update `database/schema.sql` to the resulting current schema. Never place credentials in migration files.
