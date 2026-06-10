FROM alpine:3.21

# USTC mirror for apk
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.ustc.edu.cn/g' /etc/apk/repositories

RUN apk add --no-cache \
    python3 py3-pip \
    py3-numpy py3-pandas \
    bash curl jq git

# Pure Python packages via pip (numpy/pandas already from apk)
RUN pip3 install --break-system-packages --no-cache-dir \
    requests httpx

RUN adduser -D -s /bin/bash agent
USER agent
WORKDIR /workspace

CMD ["sleep", "300"]
