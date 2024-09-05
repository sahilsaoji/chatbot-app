# main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import openai

app = FastAPI()


class ChatRequest(BaseModel):
    message: str


@app.post("/chat")
async def chat(request: ChatRequest):
    openai.api_key = "your_openai_api_key"  # Replace with your actual API key
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": request.message}],
        )
        reply = response.choices[0].message["content"]
        return {"reply": reply}
    except Exception as e:
        # Log the error (optional: you can add more sophisticated logging here)
        print(f"Error: {e}")
        # Return a friendly error message
        return {"reply": "not working dawg"}
