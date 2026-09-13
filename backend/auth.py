import os
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Depends, Response
from pydantic import BaseModel
from bson import ObjectId

from database import db

JWT_ALGORITHM = "HS256"


def jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    return user


async def require_admin(user=Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def safe_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user.get("email", ""),
        "name": user.get("name", ""),
        "role": user.get("role", ""),
        "agent_code": user.get("agent_code", ""),
        "password_changed": bool(user.get("password_changed", False)),
    }


class LoginBody(BaseModel):
    identifier: str
    password: str


class ChangePasswordBody(BaseModel):
    old_password: str
    new_password: str


auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


@auth_router.post("/login")
async def login(body: LoginBody, request: Request, response: Response):
    ident = body.identifier.strip()
    attempt_key = ident.lower()
    now = datetime.now(timezone.utc)
    att = await db.login_attempts.find_one({"identifier": attempt_key})
    if att and att.get("count", 0) >= 5 and att.get("locked_until", "") > now.isoformat():
        raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
    user = await db.users.find_one(
        {"$or": [{"email": ident.lower()}, {"agent_code": ident.upper()}]}
    )
    if not user or not verify_password(body.password, user["password_hash"]):
        count = (att.get("count", 0) if att else 0) + 1
        upd = {"identifier": attempt_key, "count": count}
        if count >= 5:
            upd["locked_until"] = (now + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": attempt_key}, {"$set": upd}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    await db.login_attempts.delete_many({"identifier": attempt_key})
    token = create_token(str(user["_id"]), user.get("role", ""))
    is_https = request.url.scheme == "https" or os.environ.get("ENVIRONMENT") == "production"
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=is_https,
        samesite="none" if is_https else "lax",
        max_age=7 * 24 * 3600,
        path="/",
    )
    return {"token": token, "user": safe_user(user)}


@auth_router.get("/me")
async def me(user=Depends(get_current_user)):
    user["password_changed"] = bool(user.get("password_changed", False))
    return user


@auth_router.post("/logout")
async def logout(request: Request, response: Response, user=Depends(get_current_user)):
    is_https = request.url.scheme == "https" or os.environ.get("ENVIRONMENT") == "production"
    response.delete_cookie(
        "access_token",
        path="/",
        httponly=True,
        secure=is_https,
        samesite="none" if is_https else "lax",
    )
    return {"ok": True}


@auth_router.post("/change-password")
async def change_password(body: ChangePasswordBody, user=Depends(get_current_user)):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
    
    full = await db.users.find_one({"_id": ObjectId(user["_id"])})
    if not full:
        raise HTTPException(status_code=404, detail="User not found")

    # Enforce ONE-TIME password change rule for agents
    if user.get("role") == "agent" and full.get("password_changed"):
        raise HTTPException(
            status_code=403,
            detail="You have already changed your password once. To change it again, please contact management / domain admin."
        )

    if not verify_password(body.old_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    await db.users.update_one(
        {"_id": full["_id"]},
        {
            "$set": {
                "password_hash": hash_password(body.new_password),
                "password_changed": True,
                "password_changed_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    )
    return {"ok": True, "password_changed": True}


async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if existing is None:
        await db.users.insert_one(
            {
                "email": email,
                "name": "Admin",
                "role": "admin",
                "password_hash": hash_password(password),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one(
            {"email": email}, {"$set": {"password_hash": hash_password(password)}}
        )
