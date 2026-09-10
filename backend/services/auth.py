import os
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
from fastapi import Request, HTTPException
from db import db
from services.util import utcnow, iso, parse, new_id

ALG = 'HS256'
ACCESS_MINUTES = 15
REFRESH_DAYS = 7
MAX_ATTEMPTS = 5
LOCK_MINUTES = 15


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def _secret() -> str:
    return os.environ['JWT_SECRET']


def create_access_token(user_id: str, email: str) -> str:
    payload = {'sub': user_id, 'email': email, 'type': 'access', 'exp': datetime.now(timezone.utc) + timedelta(minutes=ACCESS_MINUTES)}
    return jwt.encode(payload, _secret(), algorithm=ALG)


def create_refresh_token(user_id: str) -> str:
    payload = {'sub': user_id, 'type': 'refresh', 'exp': datetime.now(timezone.utc) + timedelta(days=REFRESH_DAYS)}
    return jwt.encode(payload, _secret(), algorithm=ALG)


def decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, 'Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(401, 'Invalid token')
    if payload.get('type') != expected_type:
        raise HTTPException(401, 'Invalid token type')
    return payload


def public_user(u: dict) -> dict:
    return {'id': u['id'], 'email': u['email'], 'name': u.get('name', 'Director'), 'role': u.get('role', 'director')}


def client_identifier(request: Request, email: str) -> str:
    fwd = request.headers.get('x-forwarded-for', '')
    ip = fwd.split(',')[0].strip() if fwd else (request.client.host if request.client else 'unknown')
    return f'{ip}:{email}'


async def seed_director():
    await db.users.create_index('email', unique=True)
    await db.login_attempts.create_index('identifier')
    email = os.environ['DIRECTOR_EMAIL'].strip().lower()
    password = os.environ['DIRECTOR_PASSWORD']
    existing = await db.users.find_one({'email': email})
    if existing is None:
        await db.users.insert_one({'id': new_id('usr-'), 'email': email, 'password_hash': hash_password(password),
                                   'name': 'Director', 'role': 'director', 'created_at': iso(utcnow())})
    elif not verify_password(password, existing['password_hash']):
        await db.users.update_one({'email': email}, {'$set': {'password_hash': hash_password(password)}})


async def check_lockout(identifier: str):
    doc = await db.login_attempts.find_one({'identifier': identifier})
    if not doc or doc.get('count', 0) < MAX_ATTEMPTS:
        return
    unlock_at = parse(doc['last_at']) + timedelta(minutes=LOCK_MINUTES)
    remaining = (unlock_at - utcnow()).total_seconds()
    if remaining > 0:
        raise HTTPException(429, f'Too many failed attempts. Try again in {int(remaining // 60) + 1} min.')
    await db.login_attempts.delete_one({'identifier': identifier})


async def record_failure(identifier: str):
    await db.login_attempts.update_one({'identifier': identifier}, {'$inc': {'count': 1}, '$set': {'last_at': iso(utcnow())}}, upsert=True)


async def clear_attempts(identifier: str):
    await db.login_attempts.delete_one({'identifier': identifier})


async def get_current_director(request: Request) -> dict:
    token = request.cookies.get('access_token')
    if not token:
        header = request.headers.get('Authorization', '')
        if header.startswith('Bearer '):
            token = header[7:]
    if not token:
        raise HTTPException(401, 'Director login required')
    payload = decode_token(token, 'access')
    user = await db.users.find_one({'id': payload['sub']}, {'_id': 0})
    if not user:
        raise HTTPException(401, 'User not found')
    return public_user(user)
