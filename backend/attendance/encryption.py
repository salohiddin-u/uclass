import os
from cryptography.fernet import Fernet 
import environs

env = environs.Env()
env.read_env(".env")
ENCRYPTION_KEY = env.str("ENCRYPTION_KEY")
f = Fernet(ENCRYPTION_KEY.encode())

def encrypt(text: str) -> str:
    return f.encrypt(text.encode()).decode()

def decrypt(token: str) -> str:
    try:
        return f.decrypt(token.encode()).decode()
    except:
        return None