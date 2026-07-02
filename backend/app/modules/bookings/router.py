from datetime import datetime, timedelta, timezone

import pytz
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Booking, Turf, User, BookingType, BookingStatus, PaymentStatus
from app.db.session import get_db
from app.modules.auth.deps import get_current_user

router = APIRouter(prefix="/bookings", tags=["bookings"])

# All booking times are interpreted in IST (Asia/Kolkata). The server may run
# in UTC, so every "now"/"today" comparison is localized explicitly.
IST = pytz.timezone("Asia/Kolkata")

# Sensible bounds for a single booking. Lower bound of 1 hour is enforced by
# Pydantic; the upper bound keeps a malformed/huge value from tying up a turf
# for an unrealistic span or overflowing the minute arithmetic below.
MIN_HOURS = 1
MAX_HOURS = 12
# Bookings are accepted up to this many days in advance.
MAX_ADVANCE_DAYS = 90

_DATE_FORMAT = "%Y-%m-%d"
_TIME_FORMAT = "%H:%M"


def compute_end_time(start_time: str, hours: int) -> str:
    start = datetime.strptime(start_time, "%H:%M")
    end = start + timedelta(hours=hours)
    return end.strftime("%H:%M")


def _to_minutes(time_str: str) -> int:
    h, m = map(int, time_str.split(":"))
    return h * 60 + m


class BookingCreateIn(BaseModel):
    turf_id: str
    date: str
    start_time: str
    hours: int
    booking_type: str = "private"  # 'private' or 'open_game'

    @field_validator("turf_id")
    @classmethod
    def _validate_turf_id(cls, v: str) -> str:
        v = v.strip()
        try:
            value = int(v)
        except (TypeError, ValueError) as exc:
            raise ValueError("turf_id must be a positive integer") from exc
        if value <= 0:
            raise ValueError("turf_id must be a positive integer")
        return v

    @field_validator("date")
    @classmethod
    def _validate_date(cls, v: str) -> str:
        v = v.strip()
        try:
            parsed = datetime.strptime(v, _DATE_FORMAT).date()
        except (TypeError, ValueError) as exc:
            raise ValueError("date must be in YYYY-MM-DD format") from exc
        today = datetime.now(IST).date()
        if parsed < today:
            raise ValueError("date cannot be in the past")
        if (parsed - today).days > MAX_ADVANCE_DAYS:
            raise ValueError(f"date cannot be more than {MAX_ADVANCE_DAYS} days in the future")
        return v

    @field_validator("start_time")
    @classmethod
    def _validate_start_time(cls, v: str) -> str:
        v = v.strip()
        try:
            datetime.strptime(v, _TIME_FORMAT)
        except (TypeError, ValueError) as exc:
            raise ValueError("start_time must be in HH:MM (24-hour) format") from exc
        return v

    @field_validator("hours")
    @classmethod
    def _validate_hours(cls, v: int) -> int:
        if v < MIN_HOURS:
            raise ValueError(f"hours must be at least {MIN_HOURS}")
        if v > MAX_HOURS:
            raise ValueError(f"hours cannot exceed {MAX_HOURS}")
        return v

    @field_validator("booking_type")
    @classmethod
    def _validate_booking_type(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in (BookingType.PRIVATE.value, BookingType.OPEN_GAME.value):
            raise ValueError("booking_type must be 'private' or 'open_game'")
        return v


class BookingOut(BaseModel):
    id: str
    turf_id: str
    user_id: str
    turf_name: str
    turf_image: str
    date: str
    start_time: str
    end_time: str
    hours: int
    total_amount: int
    price_per_hour: int
    booking_type: str
    status: str
    payment_status: str
    payment_id: str | None
    created_at: str


def serialize_booking(booking: Booking, turf: Turf | None = None) -> BookingOut:
    linked_turf = turf or booking.turf
    return BookingOut(
        id=str(booking.id),
        turf_id=str(booking.turf_id),
        user_id=str(booking.user_id),
        turf_name=linked_turf.name if linked_turf else "Turf",
        turf_image="https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=900&q=80",
        date=booking.date,
        start_time=booking.start_time,
        end_time=booking.end_time,
        hours=booking.hours,
        total_amount=booking.total_amount,
        price_per_hour=booking.price_per_hour,
        booking_type=booking.booking_type,
        status=booking.status,
        payment_status=booking.payment_status,
        payment_id=booking.payment_id,
        created_at=booking.created_at.isoformat(),
    )


def check_booking_overlap(
    db: Session,
    turf_id: int,
    date: str,
    start_time: str,
    end_time: str,
    exclude_booking_id: int | None = None,
) -> bool:
    """
    Return True if an overlapping active booking exists for the given turf slot.
    Active = status not in ('cancelled', 'completed').
    """
    new_start = _to_minutes(start_time)
    new_end = _to_minutes(end_time)

    query = (
        select(Booking)
        .where(Booking.turf_id == turf_id)
        .where(Booking.date == date)
        .where(Booking.status.notin_([BookingStatus.CANCELLED.value, BookingStatus.COMPLETED.value]))
    )
    if exclude_booking_id is not None:
        query = query.where(Booking.id != exclude_booking_id)

    existing = db.scalars(query).all()
    for b in existing:
        b_start = _to_minutes(b.start_time)
        b_end = _to_minutes(b.end_time)
        if new_start < b_end and new_end > b_start:
            return True
    return False


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BookingOut:
    """
    Create a private turf booking.
    For hosting a game, use POST /games/host instead.
    """
    turf_id = int(payload.turf_id)

    turf = db.get(Turf, turf_id)
    if turf is None:
        raise HTTPException(status_code=404, detail="Turf not found")

    # 1. Expiry Validation (IST - Asia/Kolkata timezone)
    now_ist = datetime.now(IST)
    booking_dt = IST.localize(
        datetime.strptime(f"{payload.date} {payload.start_time}", "%Y-%m-%d %H:%M")
    )
    if booking_dt <= now_ist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This slot has already expired and cannot be booked.",
        )

    end_time = compute_end_time(payload.start_time, payload.hours)
    total_amount = turf.price_per_hour * payload.hours

    # 2. Multi-hour Overlap Check
    if check_booking_overlap(db, turf.id, payload.date, payload.start_time, end_time):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="One or more slots in this time range are already booked.",
        )

    booking = Booking(
        user_id=user.id,
        turf_id=turf.id,
        date=payload.date,
        start_time=payload.start_time,
        end_time=end_time,
        hours=payload.hours,
        total_amount=total_amount,
        price_per_hour=turf.price_per_hour,
        booking_type=payload.booking_type,
        status=BookingStatus.CONFIRMED.value,
        payment_status=PaymentStatus.PENDING.value,
    )
    db.add(booking)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Slot already booked") from exc

    db.refresh(booking)
    return serialize_booking(booking, turf=turf)


@router.get("/me", response_model=list[BookingOut])
def my_bookings(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[BookingOut]:
    bookings = db.scalars(
        select(Booking)
        .options(selectinload(Booking.turf))
        .where(Booking.user_id == user.id)
        .order_by(Booking.created_at.desc())
    ).all()
    return [serialize_booking(booking) for booking in bookings]


@router.get("/upcoming", response_model=list[BookingOut])
def upcoming_bookings(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[BookingOut]:
    today = datetime.now(IST).date().isoformat()
    bookings = db.scalars(
        select(Booking)
        .options(selectinload(Booking.turf))
        .where(Booking.user_id == user.id)
        .where(Booking.status == BookingStatus.CONFIRMED.value)
        .where(Booking.date >= today)
        .order_by(Booking.date.asc(), Booking.start_time.asc())
    ).all()
    return [serialize_booking(booking) for booking in bookings]
