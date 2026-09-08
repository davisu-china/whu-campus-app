# ---- build stage ----
FROM golang:1.24-alpine AS builder

WORKDIR /app

# 先拷贝依赖清单，利用层缓存
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /luojia-bbs ./cmd/server

# ---- runtime stage ----
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=builder /luojia-bbs /app/luojia-bbs
COPY configs/config.yaml /app/configs/config.yaml

USER app
EXPOSE 8080

ENTRYPOINT ["/app/luojia-bbs"]
