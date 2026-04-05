"""initial

Revision ID: 0001
Revises:
Create Date: 2026-04-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        "sessions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("llm_provider", sa.String(64), nullable=False),
        sa.Column("llm_model", sa.String(128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
    )

    op.create_table(
        "messages",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", UUID(as_uuid=True),
                  sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.CheckConstraint("role IN ('user', 'assistant', 'system')", name="ck_role"),
    )

    op.create_table(
        "documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("file_type", sa.String(64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger),
        sa.Column("status", sa.String(16), nullable=False, server_default="processing"),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("file_path", sa.Text),
        sa.Column("indexed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('processing', 'ready', 'failed')", name="ck_status"
        ),
        sa.CheckConstraint("source IN ('upload', 'folder')", name="ck_source"),
    )


def downgrade():
    op.drop_table("documents")
    op.drop_table("messages")
    op.drop_table("sessions")
