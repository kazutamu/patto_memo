# Gunicorn configuration for Render deployment
import os

# Server socket
bind = f"0.0.0.0:{os.getenv('PORT', 8000)}"

# Worker processes
workers = 1
worker_class = "uvicorn.workers.UvicornWorker"

# Application
wsgi_app = "main:app"

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Process naming
proc_name = "motion-detector-api"

# Worker timeout
timeout = 120
keepalive = 2