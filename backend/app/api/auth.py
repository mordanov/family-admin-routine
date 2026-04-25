from datetime import timedelta
from fastapi import APIRouter, HTTPException, Depends, Form
from app.auth import authenticate_user, create_token, get_current_user
from app.config import REMEMBER_ME_EXPIRE_DAYS

router = APIRouter()


class LoginForm:
    def __init__(
        self,
        username: str = Form(...),
        password: str = Form(...),
        remember_me: bool = Form(False),
    ):
        self.username = username
        self.password = password
        self.remember_me = remember_me


@router.post("/login")
async def login(form: LoginForm = Depends()):
    username = authenticate_user(form.username, form.password)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    expires = timedelta(days=REMEMBER_ME_EXPIRE_DAYS) if form.remember_me else None
    return {"access_token": create_token(username, expires_delta=expires), "token_type": "bearer"}


@router.get("/me")
async def me(username: str = Depends(get_current_user)):
    return {"username": username}
