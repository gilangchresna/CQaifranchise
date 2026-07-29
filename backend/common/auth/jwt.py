"""
JWT Authentication - CyberQuote
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from common.config import get_settings

settings = get_settings()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Bearer token
security = HTTPBearer()


class TokenData(BaseModel):
    """Token payload data"""
    user_id: int
    email: str
    role: str
    exp: Optional[datetime] = None


class Token(BaseModel):
    """Token response"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    """User response"""
    id: int
    email: str
    full_name: str
    role: str


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash password"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.app.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.app.secret_key, algorithm=settings.app.algorithm)
    return encoded_jwt


def decode_token(token: str) -> Optional[TokenData]:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(
            token,
            settings.app.secret_key,
            algorithms=[settings.app.algorithm]
        )
        user_id: int = payload.get("user_id")
        email: str = payload.get("email")
        role: str = payload.get("role")
        
        if user_id is None or email is None:
            return None
        
        return TokenData(user_id=user_id, email=email, role=role)
    except JWTError:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> TokenData:
    """Get current user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    token_data = decode_token(token)
    
    if token_data is None:
        raise credentials_exception
    
    return token_data


def require_role(allowed_roles: list[str]):
    """Dependency to require specific roles"""
    async def role_checker(current_user: TokenData = Depends(get_current_user)) -> TokenData:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this resource"
            )
        return current_user
    return role_checker
