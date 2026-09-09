// App 端 API 基址：连接远程后端。生产域名可通过 EXPO_PUBLIC_API_BASE 覆盖。
// 内测阶段后端部署在 bbs.jianjiange.site（nginx 反代 /api）。
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE || 'https://bbs.jianjiange.site'
