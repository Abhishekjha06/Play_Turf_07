from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Booking, Turf, User
from app.db.session import get_db
from app.modules.auth.deps import get_current_user
router = APIRouter(prefix="/bookings", tags=["bookings"])


class BookingCreateIn(BaseModel):
    turf_id: str
    date: str
    start_time: str
    hours: int


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
    amount: int
    status: str
    payment_id: str | None
    created_at: str


def compute_end_time(start_time: str, hours: int) -> str:
    start = datetime.strptime(start_time, "%H:%M")
    end = start + timedelta(hours=hours)
    return end.strftime("%H:%M")


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
        end_time=compute_end_time(booking.start_time, booking.hours),
        hours=booking.hours,
        amount=booking.amount,
        status=booking.status,
        payment_id=booking.payment_id,
        created_at=booking.created_at.isoformat(),
    )


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(
    payload: BookingCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BookingOut:

    try:
        turf_id = int(payload.turf_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid turf_id") from exc

    turf = db.get(Turf, turf_id)
    if turf is None:
        raise HTTPException(status_code=404, detail="Turf not found")

    booking = Booking(
        user_id=user.id,
        turf_id=turf.id,
        date=payload.date,
        start_time=payload.start_time,
        hours=payload.hours,
        amount=turf.price_per_hour * payload.hours,
        status="PENDING",
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
    today = datetime.utcnow().date().isoformat()
    bookings = db.scalars(
        select(Booking)
        .options(selectinload(Booking.turf))
        .where(Booking.user_id == user.id)
        .where(Booking.status == "CONFIRMED")
        .where(Booking.date >= today)
        .order_by(Booking.date.asc(), Booking.start_time.asc())
    ).all()
    return [serialize_booking(booking) for booking in bookings]
