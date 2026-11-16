import threading

# SAM and document reading share a 16 GB machine. Run one AI job at a time.
COMPUTE_LOCK = threading.Lock()
