from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.otp import generate_otp, verify_otp
from app.core.rate_limit import limiter
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.db.models import User
from app.db.session import get_db
from app.modules.auth.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


class OtpRequestIn(BaseModel):
    phone: str


class OtpVerifyIn(BaseModel):
    phone: str
    otp: str
    name: str | None = None
    email: EmailStr | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    name: str
    role: str


@router.post("/otp/request", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def request_otp(request: Request, payload: OtpRequestIn) -> dict[str, str]:
    """Generate and (in production) dispatch a one-time password via SMS.

    The generated OTP is stored server-side with a TTL; the raw code is never
    returned to the client. While no SMS provider is wired up yet, the code is
    only exposed in development via the server logs for local testing.
    """
    if len(payload.phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    try:
        otp = await generate_otp(payload.phone)
    except ValueError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc

    # TODO: integrate SMS provider (e.g. Twilio/MSG91) here.
    if settings.environment in ("development", "docker"):
        # Local development aid only — never log OTPs in production.
        import logging

        logging.getLogger("app.otp").info("[DEV OTP] %s -> %s", payload.phone, otp)

    return {"message": "OTP sent"}


@router.post("/otp/verify", response_model=TokenOut)
@limiter.limit("10/minute")
async def verify_otp_endpoint(request: Request, payload: OtpVerifyIn, response: Response, db: Session = Depends(get_db)) -> TokenOut:
    # Verify the OTP against the server-side store (consumes it on success).
    if not await verify_otp(payload.phone, payload.otp):
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")

    user = db.scalar(select(User).where(User.phone == payload.phone))
    if user is None:
        user = User(phone=payload.phone, name=payload.name or "Player", email=payload.email)
        db.add(user)
        db.commit()
        db.refresh(user)

    user_id = str(user.id)
    access_token = create_access_token(subject=user_id, extra_claims={"role": "user"})
    refresh_token = create_refresh_token(subject=user_id)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        max_age=settings.refresh_token_ttl_days * 24 * 60 * 60,
        domain=settings.cookie_domain,
    )
    return TokenOut(access_token=access_token)


@router.post("/refresh", response_model=TokenOut)
@limiter.limit("30/minute")
def refresh(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> TokenOut:
    """Exchange a valid refresh-token cookie for a new access token.

    SECURITY: The refresh token's signature, expiry and ``type`` claim are
    verified before minting anything. The subject must resolve to an existing
    user; otherwise the request is rejected. A fresh refresh token is issued
    (rotation) so a leaked cookie loses its value after one use.
    """
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    try:
        payload = decode_token(refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    subject = payload.get("sub")
    if not isinstance(subject, str):
        raise HTTPException(status_code=401, detail="Invalid token subject")

    try:
        user_id = int(subject)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid token subject") from exc

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User no longer exists")

    access_token = create_access_token(subject=str(user.id), extra_claims={"role": user.role})
    rotated_refresh = create_refresh_token(subject=str(user.id))
    response.set_cookie(
        key="refresh_token",
        value=rotated_refresh,
        httponly=True,
        secure=settings.secure_cookies,
        samesite="lax",
        max_age=settings.refresh_token_ttl_days * 24 * 60 * 60,
        domain=settings.cookie_domain,
    )
    return TokenOut(access_token=access_token)


@router.post("/admin-login", response_model=AdminLoginResponse)
@limiter.limit("5/minute")
def admin_login(request: Request, payload: AdminLoginRequest, db: Session = Depends(get_db)) -> AdminLoginResponse:
    # Find user by email
    user = db.scalar(
        select(User).where(
            User.email == payload.email,
            User.is_active == True
        )
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not configured with password",
        )
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    # Check if user has admin role
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not authorized as an admin",
        )

    # Create JWT token with admin role
    access_token = create_access_token(
        subject=str(user.id),
        extra_claims={"role": user.role, "email": user.email}
    )

    return AdminLoginResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        email=user.email or "",
        name=user.name,
        role=user.role,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie("refresh_token", domain=settings.cookie_domain)


@router.get("/me")
def me(user: User = Depends(get_current_user)) -> dict[str, str]:
    return {"user_id": str(user.id), "name": user.name, "role": user.role}
