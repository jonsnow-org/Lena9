# نشر مستقل عبر Cloud Run — بديل مباشر لا يعتمد على AI Studio إطلاقاً.
# يبني الواجهة (Vite) وخادم Node (server.ts → dist/server.cjs) في مرحلة
# واحدة، ثم يشغّلهما في صورة تشغيل نظيفة بدون أدوات البناء.
#
# متغيرا VITE_* أدناه غير سرّيين (يُخبزان داخل حزمة الواجهة وقت البناء
# فقط، كما هو موضّح في .env.example) — يُمرَّران عبر --build-arg.

FROM node:20-slim AS build
WORKDIR /app
ARG VITE_TELEGRAM_BOT_USERNAME=""
ARG VITE_GOOGLE_OAUTH_CLIENT_ID=""
ENV VITE_TELEGRAM_BOT_USERNAME=$VITE_TELEGRAM_BOT_USERNAME
ENV VITE_GOOGLE_OAUTH_CLIENT_ID=$VITE_GOOGLE_OAUTH_CLIENT_ID
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
