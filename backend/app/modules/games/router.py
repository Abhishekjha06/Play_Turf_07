from __future__ import annotations

import asyncio
import random
import string
from datetime import datetime, timedelta

import pytz
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError

from app.db.models import (
    Booking,
    Turf,
    User,
    Game,
    GamePlayer,
    GameWaitlist,
    BookingType,
    BookingStatus,
    PaymentStatus,
    GameVisibility,
    GameStatus,
    PlayerStatus,
    WaitlistStatus,
)
from app.db.session import get_db
from app.modules.auth.deps import get_current_user
from app.modules.realtime.router import manager as ws_manager

router = APIRouter(prefix="/games", tags=["games"])

IST = pytz.timezone("Asia/Kolkata")
MIN_HOURS = 1
MAX_HOURS = 12
MAX_ADVANCE_DAYS = 90
MAX_GAME_CODE_ATTEMPTS = 10
_DATE_FORMAT = "%Y-%m-%d"
_TIME_FORMAT = "%H:%M"


# ────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────

def compute_end_time(start_time: str, hours: int) -> str:
    start = datetime.strptime(start_time, "%H:%M")
    end = start + timedelta(hours=hours)
    return end.strftime("%H:%M")


def generate_game_code(length: int = 6) -> str:
    """Generate a random uppercase alphanumeric game code."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


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


def _to_minutes(time_str: str) -> int:
    h, m = map(int, time_str.split(":"))
    return h * 60 + m


def _validate_slot_future(date: str, start_time: str) -> None:
    """Raise HTTPException if slot is in the past (IST)."""
    now_ist = datetime.now(IST)
    slot_dt = IST.localize(datetime.strptime(f"{date} {start_time}", "%Y-%m-%d %H:%M"))
    if slot_dt <= now_ist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This slot has already expired and cannot be booked.",
        )


def _validate_date_range(date: str) -> None:
    """Raise HTTPException if date is in the past or too far in the future."""
    try:
        parsed = datetime.strptime(date, _DATE_FORMAT).date()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date must be in YYYY-MM-DD format",
        ) from exc
    today = datetime.now(IST).date()
    if parsed < today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date cannot be in the past",
        )
    if (parsed - today).days > MAX_ADVANCE_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"date cannot be more than {MAX_ADVANCE_DAYS} days in the future",
        )


async def _broadcast_game_event(turf_id: int, event_type: str, payload: dict) -> None:
    """Broadcast a game event to all WebSocket subscribers for this turf."""
    await ws_manager.broadcast_to_turf(
        {
            "type": event_type,
            "turf_id": str(turf_id),
            **payload,
            "timestamp": datetime.now(IST).isoformat(),
        },
        str(turf_id),
    )


def _serialize_game(game: Game, host: User | None = None) -> dict:
    """Serialize a Game instance to a dict matching GameOut."""
    h = host or game.host
    return {
        "id": str(game.id),
        "booking_id": str(game.booking_id),
        "host_id": str(game.host_id),
        "turf_id": str(game.turf_id),
        "sport": game.sport,
        "visibility": game.visibility,
        "title": game.title,
        "description": game.description,
        "skill_level": game.skill_level,
        "gender": game.gender,
        "age_limit": game.age_limit,
        "max_players": game.max_players,
        "joined_players": game.joined_players,
        "waiting_players": game.waiting_players,
        "price_per_player": game.price_per_player,
        "status": game.status,
        "allow_waitlist": game.allow_waitlist,
        "allow_invites": game.allow_invites,
        "game_code": game.game_code,
        "start_time": game.start_time,
        "end_time": game.end_time,
        "date": game.date,
        "host_name": h.name if h else "Host",
        "created_at": game.created_at.isoformat(),
    }


def _serialize_player(player: GamePlayer) -> dict:
    return {
        "id": str(player.id),
        "user_id": str(player.user_id),
        "name": player.user.name if player.user else "Player",
        "status": player.status,
        "payment_status": player.payment_status,
        "joined_at": player.joined_at.isoformat() if player.joined_at else None,
        "approved_at": player.approved_at.isoformat() if player.approved_at else None,
    }


# ────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ────────────────────────────────────────────────────────────────

class HostGameIn(BaseModel):
    turf_id: str
    date: str
    start_time: str
    hours: int
    sport: str
    visibility: str
    title: str | None = None
    description: str | None = None
    skill_level: str | None = None
    gender: str | None = None
    age_limit: int | None = None
    max_players: int
    price_per_player: int
    allow_waitlist: bool = True
    allow_invites: bool = True

    @field_validator("turf_id")
    @classmethod
    def _validate_turf_id(cls, v: str) -> str:
        try:
            int(v)
        except ValueError as exc:
            raise ValueError("turf_id must be an integer") from exc
        return v

    @field_validator("date")
    @classmethod
    def _validate_date(cls, v: str) -> str:
        v = v.strip()
        try:
            datetime.strptime(v, _DATE_FORMAT)
        except ValueError as exc:
            raise ValueError("date must be in YYYY-MM-DD format") from exc
        return v

    @field_validator("start_time")
    @classmethod
    def _validate_start_time(cls, v: str) -> str:
        v = v.strip()
        try:
            datetime.strptime(v, _TIME_FORMAT)
        except ValueError as exc:
            raise ValueError("start_time must be in HH:MM format") from exc
        return v

    @field_validator("hours")
    @classmethod
    def _validate_hours(cls, v: int) -> int:
        if v < MIN_HOURS:
            raise ValueError(f"hours must be at least {MIN_HOURS}")
        if v > MAX_HOURS:
            raise ValueError(f"hours cannot exceed {MAX_HOURS}")
        return v

    @field_validator("visibility")
    @classmethod
    def _validate_visibility(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in (GameVisibility.PUBLIC.value, GameVisibility.PRIVATE.value):
            raise ValueError("visibility must be 'public' or 'private'")
        return v

    @field_validator("max_players")
    @classmethod
    def _validate_max_players(cls, v: int) -> int:
        if v < 2:
            raise ValueError("max_players must be at least 2")
        if v > 50:
            raise ValueError("max_players cannot exceed 50")
        return v

    @field_validator("price_per_player")
    @classmethod
    def _validate_price(cls, v: int) -> int:
        if v < 0:
            raise ValueError("price_per_player cannot be negative")
        return v


class GameOut(BaseModel):
    id: str
    booking_id: str
    host_id: str
    turf_id: str
    sport: str
    visibility: str
    title: str | None
    description: str | None
    skill_level: str | None
    gender: str | None
    age_limit: int | None
    max_players: int
    joined_players: int
    waiting_players: int
    price_per_player: int
    status: str
    allow_waitlist: bool
    allow_invites: bool
    game_code: str | None
    start_time: str
    end_time: str
    date: str
    host_name: str
    created_at: str


class PlayerOut(BaseModel):
    id: str
    user_id: str
    name: str
    status: str
    payment_status: str
    joined_at: str | None
    approved_at: str | None


class ApprovePlayerIn(BaseModel):
    player_id: str

    @field_validator("player_id")
    @classmethod
    def _validate_player_id(cls, v: str) -> str:
        try:
            int(v)
        except ValueError as exc:
            raise ValueError("player_id must be an integer") from exc
        return v


class RemovePlayerIn(BaseModel):
    player_id: str

    @field_validator("player_id")
    @classmethod
    def _validate_player_id(cls, v: str) -> str:
        try:
            int(v)
        except ValueError as exc:
            raise ValueError("player_id must be an integer") from exc
        return v


class GameListQuery(BaseModel):
    sport: str | None = None
    city: str | None = None
    date: str | None = None
    visibility: str | None = None


# ────────────────────────────────────────────────────────────────
# Host Game (Public or Private)
# ────────────────────────────────────────────────────────────────

@router.post("/host", response_model=GameOut, status_code=status.HTTP_201_CREATED)
def host_game(
    payload: HostGameIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> GameOut:
    """
    Host a public or private game.
    Creates a booking (booking_type = 'open_game') and a game on top of it.
    The host is automatically added as the first player with status 'joined'.
    """
    turf_id = int(payload.turf_id)
    turf = db.get(Turf, turf_id)
    if turf is None:
        raise HTTPException(status_code=404, detail="Turf not found")

    # Validate date/time
    _validate_date_range(payload.date)
    _validate_slot_future(payload.date, payload.start_time)

    end_time = compute_end_time(payload.start_time, payload.hours)
    total_amount = turf.price_per_hour * payload.hours

    # Check for overlapping bookings (one slot = one owner)
    if check_booking_overlap(db, turf_id, payload.date, payload.start_time, end_time):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="One or more slots in this time range are already booked.",
        )

    # Generate game code for private games
    game_code: str | None = None
    if payload.visibility == GameVisibility.PRIVATE.value:
        for _ in range(MAX_GAME_CODE_ATTEMPTS):
            candidate = generate_game_code()
            exists = db.scalar(select(Game).where(Game.game_code == candidate))
            if not exists:
                game_code = candidate
                break
        if game_code is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to generate a unique game code. Please retry.",
            )

    # Create booking (the turf ownership layer)
    booking = Booking(
        user_id=user.id,
        turf_id=turf.id,
        date=payload.date,
        start_time=payload.start_time,
        end_time=end_time,
        hours=payload.hours,
        total_amount=total_amount,
        price_per_hour=turf.price_per_hour,
        booking_type=BookingType.OPEN_GAME.value,
        status=BookingStatus.CONFIRMED.value,
        payment_status=PaymentStatus.PENDING.value,
    )
    db.add(booking)
    db.flush()  # Get booking.id without committing yet

    # Create game (the event layer)
    game = Game(
        booking_id=booking.id,
        host_id=user.id,
        turf_id=turf.id,
        sport=payload.sport,
        visibility=payload.visibility,
        title=payload.title or f"{payload.sport} at {turf.name}",
        description=payload.description,
        skill_level=payload.skill_level,
        gender=payload.gender,
        age_limit=payload.age_limit,
        max_players=payload.max_players,
        joined_players=1,
        waiting_players=0,
        price_per_player=payload.price_per_player,
        status=GameStatus.OPEN.value,
        allow_waitlist=payload.allow_waitlist,
        allow_invites=payload.allow_invites,
        game_code=game_code,
        start_time=payload.start_time,
        end_time=end_time,
        date=payload.date,
    )
    db.add(game)
    db.flush()

    # Host is automatically the first confirmed player
    host_player = GamePlayer(
        game_id=game.id,
        user_id=user.id,
        status=PlayerStatus.JOINED.value,
        payment_status=PaymentStatus.PENDING.value if payload.price_per_player > 0 else PaymentStatus.COMPLETED.value,
        joined_at=datetime.now(IST),
    )
    db.add(host_player)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Slot already booked or game code collision") from exc

    db.refresh(game)
    db.refresh(user)

    # Broadcast real-time event
    asyncio.create_task(
        _broadcast_game_event(
            turf.id,
            "game_created",
            {"game": _serialize_game(game, host=user)},
        )
    )

    return GameOut(**_serialize_game(game, host=user))


# ────────────────────────────────────────────────────────────────
# Join Public Game
# ────────────────────────────────────────────────────────────────

@router.post("/{game_id}/join", response_model=PlayerOut)
def join_public_game(
    game_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PlayerOut:
    """
    Join a public game instantly.
    Checks: game exists, is open, not cancelled, not started, has seats,
            user is not already joined, user is not the host.
    """
    gid = int(game_id)
    game = db.get(Game, gid)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found.")

    # 1. Game must be open (or full with waitlist enabled)
    if game.status == GameStatus.CANCELLED.value:
        raise HTTPException(status_code=400, detail="Cannot join a cancelled game.")
    if game.status == GameStatus.STARTED.value:
        raise HTTPException(status_code=400, detail="Game has already started.")
    if game.status == GameStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="Game has already completed.")

    # 2. Slot must not be in the past
    _validate_slot_future(game.date, game.start_time)

    # 3. Cannot be host
    if game.host_id == user.id:
        raise HTTPException(status_code=400, detail="You are the host of this game.")

    # 4. Check if already in this game (any active status)
    existing = db.scalar(
        select(GamePlayer).where(
            GamePlayer.game_id == gid,
            GamePlayer.user_id == user.id,
        )
    )
    if existing is not None:
        if existing.status in (
            PlayerStatus.JOINED.value,
            PlayerStatus.CHECKED_IN.value,
            PlayerStatus.COMPLETED.value,
            PlayerStatus.PENDING.value,
            PlayerStatus.APPROVED.value,
            PlayerStatus.PAYMENT_PENDING.value,
        ):
            raise HTTPException(status_code=400, detail="You have already joined or requested this game.")

    # 5. Seat availability
    if game.joined_players >= game.max_players:
        # If waitlist enabled, add to waitlist instead of rejecting
        if game.allow_waitlist:
            waitlist_entry = db.scalar(
                select(GameWaitlist).where(
                    GameWaitlist.game_id == gid,
                    GameWaitlist.user_id == user.id,
                )
            )
            if waitlist_entry is not None:
                raise HTTPException(status_code=400, detail="You are already on the waitlist for this game.")
            entry = GameWaitlist(
                game_id=gid,
                user_id=user.id,
                status=WaitlistStatus.WAITING.value,
            )
            db.add(entry)
            game.waiting_players += 1
            db.commit()
            db.refresh(entry)
            asyncio.create_task(
                _broadcast_game_event(
                    game.turf_id,
                    "waitlist_joined",
                    {"game_id": game_id, "user_id": str(user.id), "position": game.waiting_players},
                )
            )
            raise HTTPException(
                status_code=status.HTTP_202_ACCEPTED,
                detail="Game is full. You have been added to the waitlist.",
            )
        else:
            raise HTTPException(status_code=400, detail="This game is already full.")

    # 6. All checks pass → join
    now = datetime.now(IST)
    player = GamePlayer(
        game_id=gid,
        user_id=user.id,
        status=PlayerStatus.JOINED.value,
        payment_status=PaymentStatus.PENDING.value if game.price_per_player > 0 else PaymentStatus.COMPLETED.value,
        joined_at=now,
    )
    db.add(player)

    game.joined_players += 1
    if game.joined_players >= game.max_players:
        game.status = GameStatus.FULL.value

    db.commit()
    db.refresh(player)

    asyncio.create_task(
        _broadcast_game_event(
            game.turf_id,
            "player_joined",
            {
                "game_id": game_id,
                "player": _serialize_player(player),
                "joined_players": game.joined_players,
                "status": game.status,
            },
        )
    )

    return PlayerOut(**_serialize_player(player))


# ────────────────────────────────────────────────────────────────
# Request to Join Private Game
# ────────────────────────────────────────────────────────────────

@router.post("/{game_id}/request", response_model=PlayerOut)
def request_join_private_game(
    game_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PlayerOut:
    """
    Request to join a private game. Host must approve.
    """
    gid = int(game_id)
    game = db.get(Game, gid)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found.")

    if game.visibility != GameVisibility.PRIVATE.value:
        raise HTTPException(status_code=400, detail="This is not a private game.")

    if game.status == GameStatus.CANCELLED.value:
        raise HTTPException(status_code=400, detail="Cannot join a cancelled game.")
    if game.status == GameStatus.STARTED.value:
        raise HTTPException(status_code=400, detail="Game has already started.")
    if game.status == GameStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="Game has already completed.")

    _validate_slot_future(game.date, game.start_time)

    if game.host_id == user.id:
        raise HTTPException(status_code=400, detail="You are the host of this game.")

    # Check if already in game
    existing = db.scalar(
        select(GamePlayer).where(
            GamePlayer.game_id == gid,
            GamePlayer.user_id == user.id,
        )
    )
    if existing is not None:
        if existing.status in (
            PlayerStatus.JOINED.value,
            PlayerStatus.CHECKED_IN.value,
            PlayerStatus.COMPLETED.value,
            PlayerStatus.PENDING.value,
            PlayerStatus.APPROVED.value,
            PlayerStatus.PAYMENT_PENDING.value,
        ):
            raise HTTPException(status_code=400, detail="You have already requested or joined this game.")

    # For private games, allow request even if full (goes to waitlist after approval)
    # But if game is full and no waitlist, reject
    if game.joined_players >= game.max_players and not game.allow_waitlist:
        raise HTTPException(status_code=400, detail="This game is already full.")

    now = datetime.now(IST)
    player = GamePlayer(
        game_id=gid,
        user_id=user.id,
        status=PlayerStatus.PENDING.value,
        payment_status=PaymentStatus.PENDING.value,
        joined_at=now,
    )
    db.add(player)
    db.commit()
    db.refresh(player)

    asyncio.create_task(
        _broadcast_game_event(
            game.turf_id,
            "request_received",
            {
                "game_id": game_id,
                "player": _serialize_player(player),
            },
        )
    )

    return PlayerOut(**_serialize_player(player))


# ────────────────────────────────────────────────────────────────
# Host Approves a Player Request
# ────────────────────────────────────────────────────────────────

@router.post("/{game_id}/approve", response_model=PlayerOut)
def approve_player(
    game_id: str,
    payload: ApprovePlayerIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PlayerOut:
    """
    Host approves a pending join request.
    If the game is full, the player is added to the waitlist instead.
    """
    gid = int(game_id)
    game = db.get(Game, gid)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found.")

    if game.host_id != user.id:
        raise HTTPException(status_code=403, detail="Only the host can approve requests.")

    player_id = int(payload.player_id)
    player = db.get(GamePlayer, player_id)
    if player is None or player.game_id != gid:
        raise HTTPException(status_code=404, detail="Player request not found.")

    if player.status != PlayerStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Player request is not pending.")

    now = datetime.now(IST)

    # If game is full, put player on waitlist instead
    if game.joined_players >= game.max_players:
        if game.allow_waitlist:
            # Move player to waitlist (cancel the request, add to waitlist)
            player.status = PlayerStatus.REJECTED.value
            db.add(player)
            entry = GameWaitlist(
                game_id=gid,
                user_id=player.user_id,
                status=WaitlistStatus.WAITING.value,
            )
            db.add(entry)
            game.waiting_players += 1
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Game is full. Player has been added to the waitlist.",
            )
        else:
            raise HTTPException(status_code=400, detail="Game is already full. Cannot approve.")

    # Approve
    player.status = PlayerStatus.APPROVED.value
    player.approved_at = now
    db.add(player)

    # If game is free, auto-join; otherwise player must pay next
    if game.price_per_player == 0:
        player.status = PlayerStatus.JOINED.value
        player.joined_at = now
        game.joined_players += 1
        if game.joined_players >= game.max_players:
            game.status = GameStatus.FULL.value

    db.commit()
    db.refresh(player)

    asyncio.create_task(
        _broadcast_game_event(
            game.turf_id,
            "request_approved",
            {
                "game_id": game_id,
                "player": _serialize_player(player),
                "joined_players": game.joined_players,
                "status": game.status,
            },
        )
    )

    return PlayerOut(**_serialize_player(player))


# ────────────────────────────────────────────────────────────────
# Host Rejects a Player Request
# ────────────────────────────────────────────────────────────────

@router.post("/{game_id}/reject", response_model=PlayerOut)
def reject_player(
    game_id: str,
    payload: ApprovePlayerIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PlayerOut:
    """
    Host rejects a pending join request.
    """
    gid = int(game_id)
    game = db.get(Game, gid)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found.")

    if game.host_id != user.id:
        raise HTTPException(status_code=403, detail="Only the host can reject requests.")

    player_id = int(payload.player_id)
    player = db.get(GamePlayer, player_id)
    if player is None or player.game_id != gid:
        raise HTTPException(status_code=404, detail="Player request not found.")

    if player.status != PlayerStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Player request is not pending.")

    player.status = PlayerStatus.REJECTED.value
    db.commit()
    db.refresh(player)

    asyncio.create_task(
        _broadcast_game_event(
            game.turf_id,
            "request_rejected",
            {
                "game_id": game_id,
                "player": _serialize_player(player),
            },
        )
    )

    return PlayerOut(**_serialize_player(player))


# ────────────────────────────────────────────────────────────────
# Leave Game (before it starts)
# ────────────────────────────────────────────────────────────────

@router.post("/{game_id}/leave")
def leave_game(
    game_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """
    Player leaves a game before it starts.
    Releases the seat and may promote a waitlisted player.
    """
    gid = int(game_id)
    game = db.get(Game, gid)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found.")

    if game.status in (GameStatus.CANCELLED.value, GameStatus.COMPLETED.value):
        raise HTTPException(status_code=400, detail="Game is already over.")
    if game.status == GameStatus.STARTED.value:
        raise HTTPException(status_code=400, detail="Game has already started. Cannot leave.")

    player = db.scalar(
        select(GamePlayer).where(
            GamePlayer.game_id == gid,
            GamePlayer.user_id == user.id,
        )
    )
    if player is None:
        raise HTTPException(status_code=404, detail="You are not part of this game.")

    if player.status in (PlayerStatus.REJECTED.value, PlayerStatus.CANCELLED.value, PlayerStatus.REMOVED.value):
        raise HTTPException(status_code=400, detail="You have already left or been removed from this game.")

    now = datetime.now(IST)
    was_joined = player.status in (PlayerStatus.JOINED.value, PlayerStatus.CHECKED_IN.value)

    player.status = PlayerStatus.CANCELLED.value
    player.left_at = now
    db.add(player)

    if was_joined:
        game.joined_players = max(0, game.joined_players - 1)
        if game.status == GameStatus.FULL.value and game.joined_players < game.max_players:
            game.status = GameStatus.OPEN.value

    db.commit()

    # Promote first waitlisted player if seat opened
    promoted_player = None
    if was_joined and game.joined_players < game.max_players:
        next_wait = db.scalar(
            select(GameWaitlist)
            .where(
                GameWaitlist.game_id == gid,
                GameWaitlist.status == WaitlistStatus.WAITING.value,
            )
            .order_by(GameWaitlist.requested_at.asc())
        )
        if next_wait is not None:
            # Convert waitlist to player
            new_player = GamePlayer(
                game_id=gid,
                user_id=next_wait.user_id,
                status=PlayerStatus.JOINED.value,
                payment_status=PaymentStatus.PENDING.value if game.price_per_player > 0 else PaymentStatus.COMPLETED.value,
                joined_at=now,
            )
            db.add(new_player)
            game.joined_players += 1
            next_wait.status = WaitlistStatus.CONVERTED.value
            next_wait.converted_at = now
            game.waiting_players = max(0, game.waiting_players - 1)
            if game.joined_players >= game.max_players:
                game.status = GameStatus.FULL.value
            db.commit()
            db.refresh(new_player)
            promoted_player = _serialize_player(new_player)

    db.refresh(game)

    asyncio.create_task(
        _broadcast_game_event(
            game.turf_id,
            "player_left",
            {
                "game_id": game_id,
                "user_id": str(user.id),
                "joined_players": game.joined_players,
                "status": game.status,
                "promoted_player": promoted_player,
            },
        )
    )

    return {
        "message": "You have left the game.",
        "game_id": game_id,
        "joined_players": game.joined_players,
        "promoted_player": promoted_player,
    }


# ────────────────────────────────────────────────────────────────
# Host Removes a Player
# ────────────────────────────────────────────────────────────────

@router.post("/{game_id}/remove-player")
def remove_player(
    game_id: str,
    payload: RemovePlayerIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """
    Host removes a player from the game.
    """
    gid = int(game_id)
    game = db.get(Game, gid)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found.")

    if game.host_id != user.id:
        raise HTTPException(status_code=403, detail="Only the host can remove players.")

    player_id = int(payload.player_id)
    player = db.get(GamePlayer, player_id)
    if player is None or player.game_id != gid:
        raise HTTPException(status_code=404, detail="Player not found.")

    if player.user_id == game.host_id:
        raise HTTPException(status_code=400, detail="Cannot remove the host.")

    if player.status in (PlayerStatus.REJECTED.value, PlayerStatus.CANCELLED.value, PlayerStatus.REMOVED.value):
        raise HTTPException(status_code=400, detail="Player is already removed or cancelled.")

    now = datetime.now(IST)
    was_joined = player.status in (PlayerStatus.JOINED.value, PlayerStatus.CHECKED_IN.value)

    player.status = PlayerStatus.REMOVED.value
    player.left_at = now
    db.add(player)

    if was_joined:
        game.joined_players = max(0, game.joined_players - 1)
        if game.status == GameStatus.FULL.value and game.joined_players < game.max_players:
            game.status = GameStatus.OPEN.value

    db.commit()

    # Promote waitlist if applicable
    promoted_player = None
    if was_joined and game.joined_players < game.max_players:
        next_wait = db.scalar(
            select(GameWaitlist)
            .where(
                GameWaitlist.game_id == gid,
                GameWaitlist.status == WaitlistStatus.WAITING.value,
            )
            .order_by(GameWaitlist.requested_at.asc())
        )
        if next_wait is not None:
            new_player = GamePlayer(
                game_id=gid,
                user_id=next_wait.user_id,
                status=PlayerStatus.JOINED.value,
                payment_status=PaymentStatus.PENDING.value if game.price_per_player > 0 else PaymentStatus.COMPLETED.value,
                joined_at=now,
            )
            db.add(new_player)
            game.joined_players += 1
            next_wait.status = WaitlistStatus.CONVERTED.value
            next_wait.converted_at = now
            game.waiting_players = max(0, game.waiting_players - 1)
            if game.joined_players >= game.max_players:
                game.status = GameStatus.FULL.value
            db.commit()
            db.refresh(new_player)
            promoted_player = _serialize_player(new_player)

    db.refresh(game)

    asyncio.create_task(
        _broadcast_game_event(
            game.turf_id,
            "player_removed",
            {
                "game_id": game_id,
                "player_id": str(player_id),
                "joined_players": game.joined_players,
                "status": game.status,
                "promoted_player": promoted_player,
            },
        )
    )

    return {
        "message": "Player removed.",
        "game_id": game_id,
        "joined_players": game.joined_players,
        "promoted_player": promoted_player,
    }


# ────────────────────────────────────────────────────────────────
# Host Cancels Game
# ────────────────────────────────────────────────────────────────

@router.post("/{game_id}/cancel")
def cancel_game(
    game_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """
    Host cancels the entire game.
    Cancels the linked booking and notifies all players.
    """
    gid = int(game_id)
    game = db.get(Game, gid)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found.")

    if game.host_id != user.id:
        raise HTTPException(status_code=403, detail="Only the host can cancel the game.")

    if game.status == GameStatus.CANCELLED.value:
        raise HTTPException(status_code=400, detail="Game is already cancelled.")
    if game.status == GameStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="Game has already completed.")

    now = datetime.now(IST)
    game.status = GameStatus.CANCELLED.value

    # Cancel all active players
    players = db.scalars(
        select(GamePlayer).where(GamePlayer.game_id == gid)
    ).all()
    for p in players:
        if p.status not in (PlayerStatus.CANCELLED.value, PlayerStatus.REJECTED.value, PlayerStatus.REMOVED.value):
            p.status = PlayerStatus.CANCELLED.value
            p.left_at = now
            db.add(p)

    # Cancel the linked booking
    booking = db.get(Booking, game.booking_id)
    if booking is not None:
        booking.status = BookingStatus.CANCELLED.value
        db.add(booking)

    db.commit()

    asyncio.create_task(
        _broadcast_game_event(
            game.turf_id,
            "game_cancelled",
            {
                "game_id": game_id,
                "cancelled_at": now.isoformat(),
            },
        )
    )

    return {"message": "Game cancelled.", "game_id": game_id}


# ────────────────────────────────────────────────────────────────
# Host Starts Game
# ────────────────────────────────────────────────────────────────

@router.post("/{game_id}/start")
def start_game(
    game_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """
    Host marks the game as started.
    Joining is disabled once started.
    """
    gid = int(game_id)
    game = db.get(Game, gid)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found.")

    if game.host_id != user.id:
        raise HTTPException(status_code=403, detail="Only the host can start the game.")

    if game.status not in (GameStatus.OPEN.value, GameStatus.FULL.value):
        raise HTTPException(status_code=400, detail=f"Cannot start game from status '{game.status}'.")

    game.status = GameStatus.STARTED.value
    db.commit()

    asyncio.create_task(
        _broadcast_game_event(
            game.turf_id,
            "game_started",
            {"game_id": game_id, "started_at": datetime.now(IST).isoformat()},
        )
    )

    return {"message": "Game started.", "game_id": game_id}


# ────────────────────────────────────────────────────────────────
# Host Ends Game
# ────────────────────────────────────────────────────────────────

@router.post("/{game_id}/end")
def end_game(
    game_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """
    Host marks the game as completed.
    Marks all joined players as completed too.
    """
    gid = int(game_id)
    game = db.get(Game, gid)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found.")

    if game.host_id != user.id:
        raise HTTPException(status_code=403, detail="Only the host can end the game.")

    if game.status != GameStatus.STARTED.value:
        raise HTTPException(status_code=400, detail="Game must be started before it can be ended.")

    now = datetime.now(IST)
    game.status = GameStatus.COMPLETED.value

    players = db.scalars(
        select(GamePlayer).where(GamePlayer.game_id == gid)
    ).all()
    for p in players:
        if p.status in (PlayerStatus.JOINED.value, PlayerStatus.CHECKED_IN.value):
            p.status = PlayerStatus.COMPLETED.value
            db.add(p)

    # Complete the linked booking
    booking = db.get(Booking, game.booking_id)
    if booking is not None:
        booking.status = BookingStatus.COMPLETED.value
        db.add(booking)

    db.commit()

    asyncio.create_task(
        _broadcast_game_event(
            game.turf_id,
            "game_completed",
            {"game_id": game_id, "completed_at": now.isoformat()},
        )
    )

    return {"message": "Game completed.", "game_id": game_id}


# ────────────────────────────────────────────────────────────────
# List Games
# ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[GameOut])
def list_games(
    sport: str | None = None,
    date: str | None = None,
    visibility: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
) -> list[GameOut]:
    """
    List open games with optional filters.
    By default shows only 'open' and 'full' games (not cancelled, completed, draft, started).
    """
    query = select(Game).options(selectinload(Game.host))

    if sport:
        query = query.where(Game.sport == sport)
    if date:
        query = query.where(Game.date == date)
    if visibility:
        query = query.where(Game.visibility == visibility.lower())
    if status:
        query = query.where(Game.status == status.lower())
    else:
        # Default: show active games that are joinable or full
        query = query.where(Game.status.in_([GameStatus.OPEN.value, GameStatus.FULL.value]))

    query = query.order_by(Game.date.asc(), Game.start_time.asc())
    games = db.scalars(query).all()
    return [GameOut(**_serialize_game(g)) for g in games]


# ────────────────────────────────────────────────────────────────
# Get Game Detail
# ────────────────────────────────────────────────────────────────

@router.get("/{game_id}", response_model=GameOut)
def get_game(
    game_id: str,
    db: Session = Depends(get_db),
) -> GameOut:
    """
    Get a single game with its host details.
    """
    gid = int(game_id)
    game = db.scalar(select(Game).options(selectinload(Game.host)).where(Game.id == gid))
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found.")
    return GameOut(**_serialize_game(game))


# ────────────────────────────────────────────────────────────────
# List Players in a Game
# ────────────────────────────────────────────────────────────────

@router.get("/{game_id}/players", response_model=list[PlayerOut])
def list_players(
    game_id: str,
    db: Session = Depends(get_db),
) -> list[PlayerOut]:
    """
    List all players in a game.
    """
    gid = int(game_id)
    game = db.get(Game, gid)
    if game is None:
        raise HTTPException(status_code=404, detail="Game not found.")

    players = db.scalars(
        select(GamePlayer)
        .options(selectinload(GamePlayer.user))
        .where(GamePlayer.game_id == gid)
        .order_by(GamePlayer.joined_at.asc())
    ).all()
    return [PlayerOut(**_serialize_player(p)) for p in players]


# ────────────────────────────────────────────────────────────────
# My Games (hosted + joined)
# ────────────────────────────────────────────────────────────────

@router.get("/me", response_model=list[GameOut])
def my_games(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[GameOut]:
    """
    Get all games the user is hosting or has joined.
    """
    # Hosted games
    hosted = db.scalars(
        select(Game)
        .options(selectinload(Game.host))
        .where(Game.host_id == user.id)
    ).all()

    # Joined games (as player)
    player_rows = db.scalars(
        select(GamePlayer)
        .where(
            GamePlayer.user_id == user.id,
            GamePlayer.status.in_([
                PlayerStatus.JOINED.value,
                PlayerStatus.CHECKED_IN.value,
                PlayerStatus.COMPLETED.value,
                PlayerStatus.PENDING.value,
                PlayerStatus.APPROVED.value,
                PlayerStatus.PAYMENT_PENDING.value,
            ]),
        )
    ).all()
    joined_game_ids = [p.game_id for p in player_rows]

    joined = []
    if joined_game_ids:
        joined = db.scalars(
            select(Game)
            .options(selectinload(Game.host))
            .where(Game.id.in_(joined_game_ids))
        ).all()

    # Merge and deduplicate
    all_games = {g.id: g for g in hosted}
    for g in joined:
        all_games[g.id] = g

    return [
        GameOut(**_serialize_game(g))
        for g in sorted(all_games.values(), key=lambda x: (x.date, x.start_time))
    ]
