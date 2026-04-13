from fastapi import APIRouter, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import Depends
from app.auth import authenticate_user, create_token, get_current_user

router = APIRouter()


@router.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends()):
    username = authenticate_user(form.username, form.password)
    if not username:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": create_token(username), "token_type": "bearer"}


@router.get("/me")
async def me(username: str = Depends(get_current_user)):
    return {"username": username}
