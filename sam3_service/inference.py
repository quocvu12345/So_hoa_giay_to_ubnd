import gc
import importlib.metadata
import json
import os
import threading
import time
from datetime import datetime, timezone

import numpy as np
from PIL import Image, ImageDraw

from .config import MODEL_DIR, MODEL_ID, MODEL_REVISION, RUNTIME, checkpoint_status
from .documents import atomic_json, render_page


def clipped_box(box, width, height):
    return [max(0.0, min(float(value), float(limit)))
            for value, limit in zip(box, (width, height, width, height))]


class SamEngine:
    def __init__(self):
        self.model = None
        self.processor = None
        self.lock = threading.Lock()
        self.device = None
        self.last_error = None

    def unload(self):
        with self.lock:
            if self.model is None:
                return
            self.model = self.processor = None
            gc.collect()
            import torch
            if self.device == "mps":
                torch.mps.empty_cache()
            elif self.device == "cuda":
                torch.cuda.empty_cache()

    def status(self):
        import torch
        requested = os.environ.get("SAM3_DEVICE", "auto")
        available = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
        device = available if requested == "auto" else requested
        checkpoint = checkpoint_status()
        return {
            **checkpoint, "model_id": MODEL_ID, "model_revision": MODEL_REVISION,
            "engine": "transformers.Sam3Model", "device": self.device or device,
            "mps_available": torch.backends.mps.is_available(),
            "cuda_available": torch.cuda.is_available(), "model_loaded": self.model is not None,
            "state": "loaded" if self.model is not None else "checkpoint_available" if checkpoint["checkpoint_present"] else "needs_checkpoint",
            "versions": {name: importlib.metadata.version(name) for name in ("torch", "transformers")},
            "last_error": self.last_error,
            "message": "Đã có trọng số. Lần chạy đầu sẽ nạp model." if checkpoint["checkpoint_present"] else "Chưa có trọng số. Xin quyền facebook/sam3, chạy ./scripts/sam3.sh login rồi ./scripts/sam3.sh download trong Terminal.",
        }

    def load(self):
        if self.model is not None:
            return
        if not checkpoint_status()["checkpoint_present"]:
            raise RuntimeError("Thiếu trọng số SAM 3 chính thức. Chạy ./scripts/sam3.sh download sau khi được cấp quyền.")
        import torch
        from transformers import Sam3Model, Sam3Processor
        device = self.status()["device"]
        if device not in {"cpu", "mps", "cuda"}:
            raise ValueError("SAM3_DEVICE phải là auto, mps, cpu hoặc cuda.")
        torch.set_num_threads(4)
        # No remote code or automatic network downloads in the inference server.
        processor = Sam3Processor.from_pretrained(MODEL_DIR, local_files_only=True)
        model = Sam3Model.from_pretrained(MODEL_DIR, local_files_only=True, dtype=torch.float32)
        model = model.to(device).eval()
        self.processor, self.model, self.device = processor, model, device

    def run(self, job_id, record, page, prompt, threshold):
        import torch
        output_dir = RUNTIME / "jobs" / job_id
        output_dir.mkdir(parents=True, exist_ok=True)
        with self.lock:
            start = time.monotonic()
            self.load()
            with Image.open(render_page(record, page)) as image_file:
                image = image_file.convert("RGB")
            inputs = self.processor(images=image, text=prompt, return_tensors="pt").to(self.device)
            with torch.inference_mode():
                outputs = self.model(**inputs)
                result = self.processor.post_process_instance_segmentation(
                    outputs, threshold=threshold, mask_threshold=0.5,
                    target_sizes=inputs["original_sizes"].tolist(),
                )[0]
            boxes = result["boxes"].detach().cpu().tolist()
            scores = result["scores"].detach().cpu().tolist()
            masks = result["masks"].detach().cpu().numpy()
            overlay = image.convert("RGBA")
            regions = []
            colors = [(33, 155, 119), (224, 133, 48), (77, 116, 217), (181, 73, 140)]
            # Cap artifact count, preserving highest scoring masks. Report any truncation.
            order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:50]
            for rank, index in enumerate(order):
                color = colors[rank % len(colors)]
                mask = Image.fromarray((np.squeeze(masks[index]) > 0).astype(np.uint8) * 255)
                mask_name = f"mask-{rank + 1}.png"
                mask.save(output_dir / mask_name)
                tint = Image.new("RGBA", image.size, color + (0,))
                tint.putalpha(mask.point(lambda value: int(value * 0.3)))
                overlay = Image.alpha_composite(overlay, tint)
                box = clipped_box(boxes[index], image.width, image.height)
                x1, y1, x2, y2 = box
                regions.append({
                    "index": rank + 1, "prompt": prompt, "score": scores[index],
                    "box_xyxy": box, "raw_box_xyxy": boxes[index],
                    "normalized_box_xyxy": [x1 / image.width, y1 / image.height, x2 / image.width, y2 / image.height],
                    "mask_url": f"/api/sam3/jobs/{job_id}/artifacts/{mask_name}",
                })
            draw = ImageDraw.Draw(overlay)
            for region in regions:
                draw.rectangle(region["box_xyxy"], outline=colors[(region["index"] - 1) % len(colors)] + (255,), width=3)
                draw.text(tuple(region["box_xyxy"][:2]), str(region["index"]), fill=(180, 20, 20, 255))
            overlay.convert("RGB").save(output_dir / "overlay.jpg", quality=93)
            elapsed = round(time.monotonic() - start, 3)
            payload = {
                "job_id": job_id, "task": "promptable_concept_segmentation", "model_id": MODEL_ID,
                "model_revision": MODEL_REVISION, "engine": "transformers.Sam3Model", "device": self.device,
                "versions": self.status()["versions"], "document_id": record["id"],
                "database_file_id": record.get("database_file_id"), "source_sha256": record["sha256"],
                "source_page": page, "image_width": image.width, "image_height": image.height,
                "coordinate_system": "pixels_of_rendered_page", "prompt": prompt, "threshold": threshold,
                "elapsed_seconds": elapsed, "created_at": datetime.now(timezone.utc).isoformat(),
                "detected_count": len(scores), "exported_count": len(regions), "regions": regions,
                "overlay_url": f"/api/sam3/jobs/{job_id}/artifacts/overlay.jpg",
                "document_classification": None, "ocr_text": None,
                "note": "Điểm số vùng khớp prompt; không phải độ tin cậy phân loại nghiệp vụ. Chưa chạy OCR hoặc phân loại văn bản.",
            }
            atomic_json(output_dir / "result.json", payload)
            del outputs, inputs, result, masks
            gc.collect()
            if self.device == "mps":
                torch.mps.empty_cache()
            self.last_error = None
            return payload


engine = SamEngine()
