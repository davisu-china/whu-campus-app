// ============================================================
// 设计 token 的 TS 常量导出（供 JS 侧动态样式使用，如 canvas / 内联色）
// 值严格对齐 styles/tokens.scss，改动需两处同步（后续用脚本生成）
// ============================================================

export const tokens = {
  green: {
    50: '#EEF6F1', 100: '#D8EBE0', 200: '#B1D6C3', 300: '#83BDA3',
    400: '#549E82', 500: '#2C8063', 600: '#1F6B51', 700: '#185440',
    800: '#12402F', 900: '#0B2E21'
  },
  pink: {
    50: '#FEF4F6', 100: '#FCE6EA', 200: '#F8C7D0', 300: '#F1A0B0',
    400: '#E5738B', 500: '#D44768', 600: '#B93454'
  },
  gold: { 400: '#D6B36E', 500: '#C29A5B', 600: '#A87E42' },
  neutral: {
    paper: '#F8F6F1', surface: '#FFFFFF', surface2: '#F2EFE8',
    line: '#E7E2D8', lineStrong: '#D8D2C4'
  },
  ink: { 900: '#18201B', 700: '#3B4640', 500: '#66726B', 400: '#97A09A' },
  semantic: {
    success: '#34A26B', warning: '#D89B3C', error: '#D65C5C', info: '#5B84C4'
  }
}

export const darkTokens = {
  paper: '#121614', surface: '#1A201C', surface2: '#232B26',
  line: '#2E3832', lineStrong: '#3A453E',
  ink: { 900: '#EAF0EC', 700: '#C4CDC7', 500: '#99A49D', 400: '#6E7A72' },
  green500: '#549E82', pink500: '#E5738B', gold500: '#D6B36E'
}

export default tokens
