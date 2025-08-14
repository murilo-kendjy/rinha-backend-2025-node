# [RINHA DE BACK END 2025](https://github.com/zanfranceschi/rinha-de-backend-2025)

This is a proxy api made in NodeJs (TS) using Keydb and undici. This project is performance-oriented, using the built-in http module and a simple structure with service and external directories. KeyDb was chosen as the storage and Nginx as the load balancer.

# Tech Stack

-   Node.Js 22.18.0
-   Typescript
-   Keydb/Redis
-   Nginx
-   Undici

# How to run

`.env`

| KEY                  | DEFAULT VALUE         | DESCRIPTION                                 |
| -------------------- | --------------------- | ------------------------------------------- |
| PORT                 | 9999                  | API port                                    |
| QUEUE_SIZE           | 200                   | Number of items fetched from keydb per call |
| CONCURRENCY          | 25                    | Number of concurrent http requests          |
| PAYMENT_URL_DEFAULT  | http://localhost:8001 | Default payment provider url                |
| PAYMENT_URL_FALLBACK | http://localhost:8002 | Fallback payment provider url               |
| KEYDB_HOST           | localhost             | Keydb/Redis host                            |
| KEYDB_PORT           | 6379                  | Keydb/Redis port                            |

## DEV

**Should be used for debug purposes only**

_You need a runnning payment processor_

```
npm i
docker run --name keydb -p 6379:6379 -d eqalpha/keydb
npm run start:dev
```

## PROD

_You can setup envs in docker-compose.yaml_

```
docker compose up -d
```
