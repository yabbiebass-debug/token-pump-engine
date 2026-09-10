from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from db import db
from services import auth
from services.events import add_event

router = APIRouter(prefix='/auth', tags=['auth'])


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200)


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None


def _set_cookies(response: Response, access: str, refresh: str):
    response.set_cookie('access_token', access, httponly=True, secure=True, samesite='none', max_age=auth.ACCESS_MINUTES * 60, path='/')
    response.set_cookie('refresh_token', refresh, httponly=True, secure=True, samesite='none', max_age=auth.REFRESH_DAYS * 86400, path='/')


@router.post('/login')
async def login(body: LoginRequest, request: Request, response: Response):
    email = body.email.strip().lower()
    ident = auth.client_identifier(request, email)
    await auth.check_lockout(ident)
    user = await db.users.find_one({'email': email}, {'_id': 0})
    if not user or not auth.verify_password(body.password, user['password_hash']):
        await auth.record_failure(ident)
        raise HTTPException(401, 'Invalid email or password')
    await auth.clear_attempts(ident)
    access, refresh = auth.create_access_token(user['id'], user['email']), auth.create_refresh_token(user['id'])
    _set_cookies(response, access, refresh)
    await add_event('DIRECTOR', f"Director session opened ({user['email']}).")
    return {'user': auth.public_user(user), 'access_token': access, 'refresh_token': refresh, 'expires_in': auth.ACCESS_MINUTES * 60}


@router.post('/refresh')
async def refresh(request: Request, response: Response, body: RefreshRequest = None):
    token = (body.refresh_token if body else None) or request.cookies.get('refresh_token')
    if not token:
        raise HTTPException(401, 'Refresh token missing')
    payload = auth.decode_token(token, 'refresh')
    user = await db.users.find_one({'id': payload['sub']}, {'_id': 0})
    if not user:
        raise HTTPException(401, 'User not found')
    access = auth.create_access_token(user['id'], user['email'])
    response.set_cookie('access_token', access, httponly=True, secure=True, samesite='none', max_age=auth.ACCESS_MINUTES * 60, path='/')
    return {'access_token': access, 'expires_in': auth.ACCESS_MINUTES * 60, 'user': auth.public_user(user)}


@router.post('/logout')
async def logout(response: Response):
    response.delete_cookie('access_token', path='/')
    response.delete_cookie('refresh_token', path='/')
    return {'ok': True}


@router.get('/me')
async def me(user: dict = Depends(auth.get_current_director)):
    return user
