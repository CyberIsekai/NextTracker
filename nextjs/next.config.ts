import type { NextConfig } from 'next'
import 'dotenv/config'
import { configDotenv } from 'dotenv'

configDotenv({ path: '../.env' })

const STATIC_IPS = [
  process.env.STATIC_IP,
  process.env.STATIC_IP_2,
  process.env.STATIC_IP_3,
]
  .filter(static_ip => typeof static_ip === 'string')
  .filter(static_ip => static_ip !== '')

const nextConfig: NextConfig = {
  env: {
    APP_NAME: process.env.APP_NAME,
    FASTAPI_API_PATH: process.env.FASTAPI_API_PATH,
    NEXTJS_API_PATH: process.env.NEXTJS_API_PATH,
    ADMIN_LOGIN: process.env.ADMIN_LOGIN,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    STATIC_IPS: JSON.stringify(STATIC_IPS),
    PROTOCOL: process.env.PROTOCOL,
    NEXTJS_PORT: process.env.NEXTJS_PORT,
    TOKEN_EXPIRE_DAYS: process.env.TOKEN_EXPIRE,
    MATCHES_INTERVAL_MINUTES: process.env.MATCHES_INTERVAL,
    STATS_INTERVAL_WEEKS: process.env.STATS_INTERVAL,
    FASTAPI_PORT: process.env.FASTAPI_PORT,
    NAME_LIMIT: process.env.NAME_LIMIT,
    NAME_LIMIT_2: process.env.NAME_LIMIT_2,
    PAGE_LIMIT: process.env.PAGE_LIMIT,
    LOGS_CACHE_LIMIT: process.env.LOGS_CACHE_LIMIT,
    LOGS_GAMES_LIMIT: process.env.LOGS_GAMES_LIMIT,
    GROUP_NAME_LENGTH_REQUIRED: process.env.GROUP_NAME_LENGTH_REQUIRED,
    GROUP_NAME_LENGTH_LIMIT: process.env.GROUP_NAME_LENGTH_LIMIT,
    TEST_GROUP: process.env.TEST_GROUP,

    FASTAPI_MONITOR_HOST: process.env.FASTAPI_MONITOR_HOST,
    FASTAPI_MONITOR_PORT: process.env.FASTAPI_MONITOR_PORT,

    DATABASE_HOST: process.env.DATABASE_HOST,
    DATABASE_PORT: process.env.DATABASE_PORT,
    DATABASE_NAME: process.env.DATABASE_NAME,
    DATABASE_USER: process.env.DATABASE_USER,
    DATABASE_PASSWORD: process.env.DATABASE_PASSWORD,
    DATABASE_URL: `postgres://\
${process.env.DATABASE_USER}:\
${process.env.DATABASE_PASSWORD}@\
${process.env.DATABASE_HOST}:\
${process.env.DATABASE_PORT}/\
${process.env.DATABASE_NAME}`
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: STATIC_IPS.map(static_ip => ({
      protocol: process.env.PROTOCOL as 'http' | 'https',
      hostname: static_ip,
      port: '',
      pathname: '/map/**',
      search: '',
    })),
  },
  allowedDevOrigins: [...STATIC_IPS, '192.168.0.100', 'localhost'],
  // uncomment this only if need build on low-resource server
  // typescript: {
  //   ignoreBuildErrors: true,
  // },
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
}

export default nextConfig
