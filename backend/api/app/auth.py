import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from fastapi import HTTPException, status
from passlib.context import CryptContext

# Config (override via env)
ALGORITHM = os.getenv("JWT_ALG", "HS256")

# SECRET_KEY must be explicitly provided via JWT_SECRET environment variable
# This prevents production systems from accidentally using an insecure default
_secret_key = os.getenv("JWT_SECRET")
if not _secret_key:
    raise ValueError(
        "JWT_SECRET environment variable is required. "
        "Generate a secure key with: openssl rand -hex 32"
    )
SECRET_KEY = _secret_key

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))

# passlib context using Argon2 (recommended). Ensure passlib[argon2] installed.
pwd_ctx = CryptContext(schemes=["argon2"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2 via passlib.

    Args:
        password: The plaintext password to hash.

    Returns:
        A secure hashed representation of the password suitable for storage.
    """
    return pwd_ctx.hash(password)

def verify_password(plain_password: str, stored_password_hash: str) -> bool:
    """Verify a plaintext password against its stored hash.

    Args:
        plain_password: Plaintext password to verify.
        stored_password_hash: Stored password hash to verify against.

    Returns:
        True if verification succeeds, False otherwise.
    """
    return pwd_ctx.verify(plain_password, stored_password_hash)

def create_access_token(token_payload: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token.

    Args:
        token_payload: Payload claims to include in the token (e.g., {'sub': user_id}).
        expires_delta: Optional timedelta overriding default expiration.

    Returns:
        Encoded JWT string.
    """
    claims_to_encode = token_payload.copy()
    # Use naive UTC datetimes to match TIMESTAMP WITHOUT TIME ZONE columns in PostgreSQL
    expiration_time = datetime.now(timezone.utc).replace(tzinfo=None) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    claims_to_encode.update({"exp": expiration_time})
    encoded_access_token = jwt.encode(claims_to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_access_token

def decode_access_token(encoded_access_token: str) -> Optional[Dict[str, Any]]:
    """Decode and verify a JWT access token.

    Args:
        encoded_access_token: Encoded JWT string.

    Returns:
        Payload dict if token is valid, otherwise None.
    """
    try:
        token_payload = jwt.decode(encoded_access_token, SECRET_KEY, algorithms=[ALGORITHM])
        return token_payload
    except InvalidTokenError:
        return None

def make_refresh_token() -> str:
    """Generate a new opaque refresh token (preimage returned to client).

    Returns:
        URL-safe opaque string suitable for use as a refresh token.
    """
    raw_token = secrets.token_urlsafe(64)
    return raw_token

def hash_token(raw_token: str) -> str:
    """Hash the opaque token for secure server-side storage (sha256).

    Args:
        raw_token: The raw refresh or invite token to hash.

    Returns:
        Hex-encoded SHA256 digest of the token.
    """
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    return token_hash

# Helper for tests: when TEST_MODE=1 endpoints may return raw refresh tokens for assertions.
def is_test_mode() -> bool:
    """Return True when running in test mode (controlled by TEST_MODE env var)."""
    return os.getenv("TEST_MODE", "0") == "1"


def authenticate_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a JWT bearer token.

    Behavior:
    - On success: returns a dict {"user_id": <sub>, "tenant_id": <tenant_id>}.
    - If the token is expired: raises HTTPException 401 with detail "Token expired".
    - If the token is invalid or missing required claims: raises HTTPException 401.

    Notes:
    - We expect access tokens created via create_access_token to include at least
      "sub" (user identifier) and "tenant_id" claims.
    - Uses PyJWT for verification which will raise ExpiredSignatureError for expired tokens.

    Args:
        token: Encoded JWT access token from an Authorization header.

    Returns:
        A dict with 'user_id' and 'tenant_id' extracted from the token payload.
    """
    try:
        # Decode the JWT and verify signature + expiration using PyJWT
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except ExpiredSignatureError:
        # Token is structurally valid but the exp claim is in the past
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except InvalidTokenError:
        # Any other JWT error (bad signature, malformed, wrong alg, etc.)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    # Extract required identifiers
    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")

    # Validate presence of required claims
    if user_id is None or tenant_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    # Return a normalized structure for callers
    return {"user_id": user_id, "tenant_id": tenant_id}
