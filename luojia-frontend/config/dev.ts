import type { UserConfigExport } from '@tarojs/cli'

export default {
  logger: {
    quiet: false,
    stats: true
  },
  mini: {},
  h5: {},
  // 开发环境 API 地址（后端本地 /api/v1）
  defineConstants: {
    API_BASE: JSON.stringify('http://localhost:8080')
  }
} satisfies UserConfigExport<'webpack5'>
