FROM golang:1.22-alpine AS build
WORKDIR /app
RUN apk add --no-cache git ca-certificates
ENV CGO_ENABLED=0
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=sum.golang.google.cn
COPY Blockchain-backend/ ./Blockchain-backend/
WORKDIR /app/Blockchain-backend
RUN go build -o /app/server .

FROM alpine:3.20
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY --from=build /app/server ./server
EXPOSE 8080
ENTRYPOINT ["/app/server"]


