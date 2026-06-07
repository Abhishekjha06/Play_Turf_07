from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(30), default="user", server_default="user")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    # Client authentication fields
    client_id: Mapped[str | None] = mapped_column(String(50), unique=True, index=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Client profile fields
    company_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    bookings: Mapped[list["Booking"]] = relationship(back_populates="user")
    turfs: Mapped[list["Turf"]] = relationship(back_populates="client")


class Turf(Base):
    __tablename__ = "turfs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), index=True)
    city: Mapped[str] = mapped_column(String(80), index=True)
    address: Mapped[str] = mapped_column(String(255))
    price_per_hour: Mapped[int] = mapped_column(Integer)
    rating: Mapped[float] = mapped_column(Numeric(3, 2), default=0, server_default="0")
    is_popular: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_nearby: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # Client ownership
    client_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
    # Additional fields for client management
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amenities: Mapped[str | None] = mapped_column(Text, nullable=True)
    opening_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    closing_time: Mapped[str | None] = mapped_column(String(5), nullable=True)
    holiday_dates: Mapped[str | None] = mapped_column(Text, nullable=True)
    peak_hours: Mapped[str | None] = mapped_column(Text, nullable=True)
    special_pricing: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancellation_policy: Mapped[str | None] = mapped_column(Text, nullable=True)
    parking_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    turf_rules: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    bookings: Mapped[list["Booking"]] = relationship(back_populates="turf")
    client: Mapped[User | None] = relationship(back_populates="turfs")


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        UniqueConstraint("turf_id", "date", "start_time", name="uq_booking_turf_date_start"),
        Index("ix_bookings_user_date", "user_id", "date"),
        Index("ix_bookings_turf_date_status", "turf_id", "date", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    turf_id: Mapped[int] = mapped_column(ForeignKey("turfs.id", ondelete="CASCADE"), index=True)
    date: Mapped[str] = mapped_column(String(10), index=True)
    start_time: Mapped[str] = mapped_column(String(5))
    hours: Mapped[int] = mapped_column(Integer)
    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", server_default="PENDING", index=True)
    payment_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped[User] = relationship(back_populates="bookings")
    turf: Mapped[Turf] = relationship(back_populates="bookings")
