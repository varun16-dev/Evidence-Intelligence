import logging
import os
import sys
from backend.app.config import settings

def setup_logging():
    log_dir = os.path.dirname(settings.LOG_FILE)
    if log_dir and not os.path.exists(log_dir):
        os.makedirs(log_dir, exist_ok=True)

    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    log_format = (
        "[%(asctime)s] [%(levelname)s] [%(name)s:%(lineno)d] %(message)s"
    )

    handlers = [
        logging.StreamHandler(sys.stdout),
    ]

    try:
        handlers.append(logging.FileHandler(settings.LOG_FILE, encoding="utf-8"))
    except Exception as e:
        print(f"Warning: Could not configure file logger: {e}", file=sys.stderr)

    logging.basicConfig(
        level=log_level,
        format=log_format,
        handlers=handlers,
        force=True
    )

    # Silence overly verbose third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    logger = logging.getLogger("evidence_intelligence")
    logger.info(f"Logging initialized with level: {settings.LOG_LEVEL}")
    return logger

logger = setup_logging()
