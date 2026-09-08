import type { UserConfigExport } from '@tarojs/cli'

export default {
  mini: {},
  h5: {},
  // 生产环境 API 地址：默认 https://bbs.jianjiange.site，
  // 也可构建时通过环境变量 API_BASE 覆盖（CI/部署脚本 export API_BASE=...）。
  defineConstants: {
    API_BASE: JSON.stringify(process.env.API_BASE || 'https://bbs.jianjiange.site')
  }
} satisfies UserConfigExport<'webpack5'>
