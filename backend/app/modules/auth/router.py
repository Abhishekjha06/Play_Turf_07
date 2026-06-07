from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, create_refresh_token, verify_password
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
def request_otp(payload: OtpRequestIn) -> dict[str, str]:
    # Placeholder until SMS provider is wired.
    if len(payload.phone) < 10:
        raise HTTPException(status_code=400, detail="Invalid phone number")
    return {"message": "OTP sent"}


@router.post("/otp/verify", response_model=TokenOut)
def verify_otp(payload: OtpVerifyIn, response: Response, db: Session = Depends(get_db)) -> TokenOut:
    if payload.otp != "123456":
        raise HTTPException(status_code=401, detail="Invalid OTP")

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
def refresh(refresh_token: str | None = Cookie(default=None)) -> TokenOut:
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    # Signature/expiry verification will be tightened with token persistence and rotation.
    access_token = create_access_token(subject="user:session", extra_claims={"role": "user"})
    return TokenOut(access_token=access_token)


@router.post("/admin-login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest, db: Session = Depends(get_db)) -> AdminLoginResponse:
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
