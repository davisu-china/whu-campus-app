import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { useToastStore } from '@whu/shared'

// 订阅 shared 的 toast store，把 message 渲染成底部 Snackbar（request 层与业务共用）。
export function ToastHost() {
  const message = useToastStore((s) => s.message)
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!message) return
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true })
    ])
    anim.start(() => useToastStore.getState().clear())
    return () => anim.stop()
  }, [message, opacity])

  if (!message) return null

  return (
    <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 80,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(24,32,27,0.92)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center'
  },
  text: {
    color: '#fff',
    fontSize: 14
  }
})
