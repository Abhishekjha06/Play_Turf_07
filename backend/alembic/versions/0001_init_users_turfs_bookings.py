"""init users turfs bookings

Revision ID: 0001_init_users_turfs_bookings
Revises:
Create Date: 2026-05-07 10:29:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0001_init_users_turfs_bookings"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("role", sa.String(length=30), server_default="user", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_phone"), "users", ["phone"], unique=True)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "turfs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("city", sa.String(length=80), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("price_per_hour", sa.Integer(), nullable=False),
        sa.Column("rating", sa.Numeric(precision=3, scale=2), server_default="0", nullable=False),
        sa.Column("is_popular", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_nearby", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_turfs_name"), "turfs", ["name"], unique=False)
    op.create_index(op.f("ix_turfs_city"), "turfs", ["city"], unique=False)

    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("turf_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.String(length=10), nullable=False),
        sa.Column("start_time", sa.String(length=5), nullable=False),
        sa.Column("hours", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="PENDING", nullable=False),
        sa.Column("payment_id", sa.String(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["turf_id"], ["turfs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("turf_id", "date", "start_time", name="uq_booking_turf_date_start"),
    )
    op.create_index(op.f("ix_bookings_user_id"), "bookings", ["user_id"], unique=False)
    op.create_index(op.f("ix_bookings_turf_id"), "bookings", ["turf_id"], unique=False)
    op.create_index(op.f("ix_bookings_date"), "bookings", ["date"], unique=False)
    op.create_index(op.f("ix_bookings_status"), "bookings", ["status"], unique=False)
    op.create_index("ix_bookings_user_date", "bookings", ["user_id", "date"], unique=False)
    op.create_index("ix_bookings_turf_date_status", "bookings", ["turf_id", "date", "status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_bookings_turf_date_status", table_name="bookings")
    op.drop_index("ix_bookings_user_date", table_name="bookings")
    op.drop_index(op.f("ix_bookings_status"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_date"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_turf_id"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_user_id"), table_name="bookings")
    op.drop_table("bookings")

    op.drop_index(op.f("ix_turfs_city"), table_name="turfs")
    op.drop_index(op.f("ix_turfs_name"), table_name="turfs")
    op.drop_table("turfs")

    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_phone"), table_name="users")
    op.drop_table("users")
