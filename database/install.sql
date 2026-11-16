\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('hoso-schema-install-v1'));
CREATE SCHEMA IF NOT EXISTS hoso;
CREATE TABLE IF NOT EXISTS hoso.schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
SELECT EXISTS(SELECT 1 FROM hoso.schema_migrations WHERE version=1) AS already_installed \gset
\if :already_installed
  \echo 'Migration 001 already installed; existing rows will be preserved.'
\else
  \ir 001_schema.sql
  INSERT INTO hoso.schema_migrations(version) VALUES(1);
\endif
\ir 002_seed_catalog.sql
\ir 003_seed_public_documents.sql
COMMIT;
