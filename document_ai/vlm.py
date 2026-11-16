"""Private, single-request MLX adapter for Paddle's local crop-reading stage.

Use the tested generate() path. The general mlx-vlm server's continuous-batching
path produced repeated text on our Vietnamese PDF fixture with version 0.7.12.
"""
import base64
import io
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .config import model_path

MODEL = PROCESSOR = CONFIG = None
LOCK = threading.Lock()


@asynccontextmanager
async def lifespan(app):
    global MODEL, PROCESSOR, CONFIG
    from mlx_vlm import load
    from mlx_vlm.utils import load_config
    path = str(model_path("ocr"))
    MODEL, PROCESSOR = load(path)
    CONFIG = load_config(path)
    yield


app = FastAPI(lifespan=lifespan)


class Completion(BaseModel):
    model: str
    messages: list[dict] = Field(max_length=4)
    max_tokens: int = Field(default=4096, ge=1, le=8192)
    temperature: float = 0


@app.get("/v1/models")
def models():
    return {"data": [{"id": str(model_path("ocr"))}]}


@app.post("/v1/chat/completions")
def completion(body: Completion):
    from PIL import Image
    from mlx_vlm import generate
    from mlx_vlm.prompt_utils import apply_chat_template
    if body.model != str(model_path("ocr")):
        raise HTTPException(400, "Only the installed OCR model is allowed.")
    images, texts = [], []
    for message in body.messages:
        for item in message.get("content", []):
            if not isinstance(item, dict):
                raise HTTPException(400, "Expected multimodal content.")
            if item.get("type") == "text":
                texts.append(item["text"])
            elif item.get("type") == "image_url":
                value = item["image_url"]["url"]
                if not value.startswith("data:image/") or len(value) > 24_000_000:
                    raise HTTPException(400, "Only local image data is accepted.")
                image = Image.open(io.BytesIO(base64.b64decode(value.split(",", 1)[1], validate=True)))
                if image.width * image.height > 16_000_000:
                    raise HTTPException(400, "Image is too large.")
                images.append(image.convert("RGB"))
    if len(images) != 1:
        raise HTTPException(400, "Read one region at a time.")
    with LOCK:
        prompt = apply_chat_template(PROCESSOR, CONFIG, "\n".join(texts), num_images=1)
        result = generate(MODEL, PROCESSOR, prompt, image=images[0], max_tokens=body.max_tokens,
                          temperature=0.0, verbose=False)
    if result.finish_reason == "length":
        raise HTTPException(422, "OCR region exceeded output limit; split the page or review its source.")
    return {"id": "local-ocr", "object": "chat.completion", "model": body.model,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": result.text}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": result.prompt_tokens, "completion_tokens": result.generation_tokens,
                      "total_tokens": result.total_tokens}}
