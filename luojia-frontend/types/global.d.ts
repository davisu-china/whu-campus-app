/// <reference types="@tarojs/taro" />

declare module '*.scss'
declare module '*.png'
declare module '*.svg'

// 由 config/dev.ts | config/prod.ts 的 defineConstants 注入
declare const API_BASE: string

declare const process: {
  env: {
    NODE_ENV: 'development' | 'production'
    TARO_ENV: 'weapp' | 'swan' | 'alipay' | 'tt' | 'qq' | 'jd' | 'h5' | 'rn'
  }
}
