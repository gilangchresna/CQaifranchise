"""
Authentication API Routes
"""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from common.auth.jwt import (
    Token,
    UserResponse,
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from common.config import get_settings
from common.db.database import get_db
from common.db.models import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()
settings = get_settings()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "FRANCHISEE_OWNER"


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


@router.post("/login", response_model=Token)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login and get access token"""
    # Find user
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled"
        )
    
    # Create token
    access_token = create_access_token(
        data={
            "user_id": user.id,
            "email": user.email,
            "role": user.role.value,
        },
        expires_delta=timedelta(minutes=settings.app.access_token_expire_minutes)
    )
    
    return Token(
        access_token=access_token,
        expires_in=settings.app.access_token_expire_minutes * 60
    )


@router.post("/register", response_model=UserResponse)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register new user"""
    # Check if email exists
    result = await db.execute(select(User).where(User.email == request.email))
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user = User(
        email=request.email,
        password_hash=get_password_hash(request.password),
        full_name=request.full_name,
        role=request.role,
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user = Depends(get_current_user)):
    """Get current user info"""
    return UserResponse(
        id=current_user.user_id,
        email=current_user.email,
        full_name="",  # Would fetch from DB
        role=current_user.role
    )


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Change password"""
    result = await db.execute(select(User).where(User.id == current_user.user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not verify_password(request.old_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    user.password_hash = get_password_hash(request.new_password)
    await db.commit()
    
    return {"message": "Password changed successfully"}
