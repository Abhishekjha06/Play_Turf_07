from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import verify_password, create_access_token
from app.db.models import User
from app.db.session import get_db

router = APIRouter(prefix="/auth/client", tags=["client-auth"])


class ClientLoginRequest(BaseModel):
    client_id: str
    password: str


class ClientLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    client_id: str
    name: str
    role: str


@router.post("/login", response_model=ClientLoginResponse)
def client_login(payload: ClientLoginRequest, db: Session = Depends(get_db)):
    # Find user by client_id (unique)
    user = db.scalar(
        select(User).where(
            User.client_id == payload.client_id,
            User.is_active == True
        )
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid client ID or password",
        )
    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Client account not configured with password",
        )
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid client ID or password",
        )
    # Ensure user has role "client" or similar
    if user.role not in ("client", "admin", "owner"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not authorized as a client",
        )

    # Create JWT token
    access_token = create_access_token(
        subject=str(user.id),
        extra_claims={"role": user.role, "client_id": user.client_id}
    )

    return ClientLoginResponse(
        access_token=access_token,
        token_type="bearer",
        user_id=user.id,
        client_id=user.client_id,
        name=user.name,
        role=user.role,
    )