from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# ────────────────────────────────────────────────────────────────
# Enums (mirrored in Python for validation; DB stores strings)
# ────────────────────────────────────────────────────────────────

class BookingType(str, PyEnum):
    PRIVATE = "private"
    OPEN_GAME = "open_game"


class BookingStatus(str, PyEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class PaymentStatus(str, PyEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class GameVisibility(str, PyEnum):
    PUBLIC = "public"
    PRIVATE = "private"


class GameStatus(str, PyEnum):
    DRAFT = "draft"
    OPEN = "open"
    FULL = "full"
    STARTED = "started"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class PlayerStatus(str, PyEnum):
    PENDING = "pending"          # private game: waiting for host approval
    APPROVED = "approved"        # host approved, waiting for payment
    PAYMENT_PENDING = "payment_pending"
    JOINED = "joined"            # paid / confirmed participant
    CHECKED_IN = "checked_in"
    COMPLETED = "completed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    REMOVED = "removed"
    NO_SHOW = "no_show"


class WaitlistStatus(str, PyEnum):
    WAITING = "waiting"
    NOTIFIED = "notified"
    EXPIRED = "expired"
    CONVERTED = "converted"


# ────────────────────────────────────────────────────────────────
# User
# ────────────────────────────────────────────────────────────────

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
    hosted_games: Mapped[list["Game"]] = relationship(back_populates="host")
    game_players: Mapped[list["GamePlayer"]] = relationship(back_populates="user")
    waitlist_entries: Mapped[list["GameWaitlist"]] = relationship(back_populates="user")


# ────────────────────────────────────────────────────────────────
# Turf
# ────────────────────────────────────────────────────────────────

class Turf(Base):
    __tablename__ = "turfs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), index=True)
    city: Mapped[str] = mapped_column(String(80), index=True)
    address: Mapped[str] = mapped_column(String(255))
    lat: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    lng: Mapped[float | None] = mapped_column(Numeric(10, 7), nullable=True)
    image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    gallery: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of URLs
    rating: Mapped[float] = mapped_column(Numeric(3, 2), default=0, server_default="0")
    timing: Mapped[str | None] = mapped_column(String(30), nullable=True)  # e.g. "06:00 AM – 11:00 PM"
    price_per_hour: Mapped[int] = mapped_column(Integer)
    sport_types: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of strings
    amenities: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of strings
    videos: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of URLs
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_popular: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    is_nearby: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # Client ownership
    client_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True, nullable=True)
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
    games: Mapped[list["Game"]] = relationship(back_populates="turf")


# ────────────────────────────────────────────────────────────────
# Booking  —  owns the turf slot
# ────────────────────────────────────────────────────────────────

class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        # One active booking per turf per exact date + start_time combo.
        # Overlap is checked in application code (SQLite lacks exclusion constraints).
        UniqueConstraint(
            "turf_id", "date", "start_time",
            name="uq_booking_turf_date_start",
        ),
        Index("ix_bookings_user_date", "user_id", "date"),
        Index("ix_bookings_turf_date_status", "turf_id", "date", "status"),
        Index("ix_bookings_type", "booking_type"),
        CheckConstraint(
            "status IN ('pending', 'confirmed', 'cancelled', 'completed')",
            name="ck_booking_status",
        ),
        CheckConstraint(
            "booking_type IN ('private', 'open_game')",
            name="ck_booking_type",
        ),
        CheckConstraint(
            "payment_status IN ('pending', 'completed', 'failed', 'refunded')",
            name="ck_booking_payment_status",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    turf_id: Mapped[int] = mapped_column(ForeignKey("turfs.id", ondelete="CASCADE"), index=True)
    date: Mapped[str] = mapped_column(String(10), index=True)  # YYYY-MM-DD
    start_time: Mapped[str] = mapped_column(String(5))         # HH:MM
    end_time: Mapped[str] = mapped_column(String(5))           # HH:MM
    hours: Mapped[int] = mapped_column(Integer)
    # Financials
    total_amount: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    price_per_hour: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # Classification
    booking_type: Mapped[str] = mapped_column(
        String(20),
        default=BookingType.PRIVATE.value,
        server_default=BookingType.PRIVATE.value,
        index=True,
    )
    # Lifecycle
    status: Mapped[str] = mapped_column(
        String(20),
        default=BookingStatus.PENDING.value,
        server_default=BookingStatus.PENDING.value,
        index=True,
    )
    payment_status: Mapped[str] = mapped_column(
        String(20),
        default=PaymentStatus.PENDING.value,
        server_default=PaymentStatus.PENDING.value,
    )
    payment_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Receipt / meta
    receipt_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped[User] = relationship(back_populates="bookings")
    turf: Mapped[Turf] = relationship(back_populates="bookings")
    game: Mapped["Game | None"] = relationship(back_populates="booking", uselist=False)


# ────────────────────────────────────────────────────────────────
# Game  —  event built on top of a Booking
# ────────────────────────────────────────────────────────────────

class Game(Base):
    __tablename__ = "games"
    __table_args__ = (
        UniqueConstraint("booking_id", name="uq_game_booking"),
        CheckConstraint(
            "status IN ('draft', 'open', 'full', 'started', 'completed', 'cancelled')",
            name="ck_game_status",
        ),
        CheckConstraint(
            "visibility IN ('public', 'private')",
            name="ck_game_visibility",
        ),
        CheckConstraint(
            "joined_players <= max_players",
            name="ck_game_joined_not_exceed_max",
        ),
        CheckConstraint(
            "waiting_players >= 0",
            name="ck_game_waiting_nonnegative",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), unique=True, index=True)
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    turf_id: Mapped[int] = mapped_column(ForeignKey("turfs.id", ondelete="CASCADE"), index=True)

    # Game identity
    sport: Mapped[str] = mapped_column(String(50), index=True)
    visibility: Mapped[str] = mapped_column(String(20), default=GameVisibility.PUBLIC.value, index=True)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    game_code: Mapped[str | None] = mapped_column(String(20), unique=True, index=True, nullable=True)

    # Requirements / filters
    skill_level: Mapped[str | None] = mapped_column(String(30), nullable=True)  # beginner, intermediate, advanced
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)       # male, female, mixed, any
    age_limit: Mapped[int | None] = mapped_column(Integer, nullable=True)        # minimum age

    # Capacity & pricing
    max_players: Mapped[int] = mapped_column(Integer, default=10, server_default="10")
    joined_players: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    waiting_players: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    price_per_player: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    # Status & features
    status: Mapped[str] = mapped_column(String(20), default=GameStatus.OPEN.value, server_default=GameStatus.OPEN.value, index=True)
    allow_waitlist: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    allow_invites: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    # Timing (copied from booking for fast querying, but source of truth is booking)
    start_time: Mapped[str] = mapped_column(String(5))  # HH:MM
    end_time: Mapped[str] = mapped_column(String(5))    # HH:MM
    date: Mapped[str] = mapped_column(String(10), index=True)  # YYYY-MM-DD

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    booking: Mapped[Booking] = relationship(back_populates="game", uselist=False)
    host: Mapped[User] = relationship(back_populates="hosted_games")
    turf: Mapped[Turf] = relationship(back_populates="games")
    players: Mapped[list["GamePlayer"]] = relationship(back_populates="game", cascade="all, delete-orphan")
    waitlist: Mapped[list["GameWaitlist"]] = relationship(back_populates="game", cascade="all, delete-orphan")


# ────────────────────────────────────────────────────────────────
# GamePlayer  —  every player's relationship with a game
# ────────────────────────────────────────────────────────────────

class GamePlayer(Base):
    __tablename__ = "game_players"
    __table_args__ = (
        UniqueConstraint("game_id", "user_id", name="uq_game_player"),
        CheckConstraint(
            "status IN ('pending', 'approved', 'payment_pending', 'joined', 'checked_in', "
            "'completed', 'rejected', 'cancelled', 'removed', 'no_show')",
            name="ck_player_status",
        ),
        CheckConstraint(
            "payment_status IN ('pending', 'completed', 'failed', 'refunded')",
            name="ck_player_payment_status",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    status: Mapped[str] = mapped_column(
        String(20),
        default=PlayerStatus.JOINED.value,
        server_default=PlayerStatus.JOINED.value,
        index=True,
    )
    payment_status: Mapped[str] = mapped_column(
        String(20),
        default=PaymentStatus.PENDING.value,
        server_default=PaymentStatus.PENDING.value,
    )

    # Timestamps
    joined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    game: Mapped[Game] = relationship(back_populates="players")
    user: Mapped[User] = relationship(back_populates="game_players")


# ────────────────────────────────────────────────────────────────
# GameWaitlist  —  players waiting for a seat to open
# ────────────────────────────────────────────────────────────────

class GameWaitlist(Base):
    __tablename__ = "game_waitlist"
    __table_args__ = (
        UniqueConstraint("game_id", "user_id", name="uq_game_waitlist"),
        CheckConstraint(
            "status IN ('waiting', 'notified', 'expired', 'converted')",
            name="ck_waitlist_status",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    status: Mapped[str] = mapped_column(
        String(20),
        default=WaitlistStatus.WAITING.value,
        server_default=WaitlistStatus.WAITING.value,
        index=True,
    )

    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    game: Mapped[Game] = relationship(back_populates="waitlist")
    user: Mapped[User] = relationship(back_populates="waitlist_entries")
