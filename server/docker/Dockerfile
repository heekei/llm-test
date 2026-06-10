FROM ubuntu:24.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    nodejs npm \
    curl ca-certificates jq git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Common Python packages for data/analysis tasks
RUN pip3 install --break-system-packages \
    numpy pandas requests httpx

# Non-root user for security
RUN useradd -m -s /bin/bash agent
USER agent
WORKDIR /workspace

# Default: sleep (controlled by dockerode via Cmd override)
CMD ["sleep", "300"]
