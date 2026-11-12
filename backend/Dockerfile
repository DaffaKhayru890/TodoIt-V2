# syntax=docker/dockerfile:1.7

ARG GO_VERSION=1.27
ARG ALPINE_VERSION=3.22

# -----------------------------------------------------------------------------
# base: Go toolchain + dependency cache
# -----------------------------------------------------------------------------
FROM golang:${GO_VERSION}-alpine AS base
WORKDIR /src
RUN apk add --no-cache ca-certificates tzdata git
ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOFLAGS=-buildvcs=false
COPY go.mod go.sum ./
RUN go mod download

# -----------------------------------------------------------------------------
# development: hot reload dengan Air
# -----------------------------------------------------------------------------
FROM base AS development
RUN go install github.com/air-verse/air@v1.67.4
WORKDIR /src
COPY . .
EXPOSE 8080
CMD ["air", "-c", ".air.toml"]

# -----------------------------------------------------------------------------
# test: menjalankan unit/integration test (command dapat dioverride Compose)
# -----------------------------------------------------------------------------
FROM base AS test
WORKDIR /src
COPY . .
CMD ["go", "test", "./..."]

# -----------------------------------------------------------------------------
# builder: kompilasi binary statis
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /src
COPY . .
RUN go build -trimpath -buildvcs=false -ldflags="-s -w" -o /out/api ./cmd/api

# -----------------------------------------------------------------------------
# production: distroless, non-root, tanpa compiler/source
# -----------------------------------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot AS production
WORKDIR /app
COPY --from=builder /out/api /app/api
EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/app/api"]
