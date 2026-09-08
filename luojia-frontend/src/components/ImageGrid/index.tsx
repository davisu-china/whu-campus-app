import { View, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

interface ImageGridProps {
  images: string[]
  preview?: boolean
}

// 图片九宫格（列表最多 3 张预览，详情展示全量）
export default function ImageGrid({ images, preview = true }: ImageGridProps) {
  const count = images.length
  const cols = count === 1 ? 1 : count === 2 || count === 4 ? 2 : 3

  const onPress = (i: number) => {
    if (preview) Taro.previewImage({ current: images[i], urls: images })
  }

  return (
    <View className={`luo-img-grid cols-${cols}`}>
      {images.map((url, i) => (
        <Image key={i} className='luo-img-grid-item' src={url} mode='aspectFill' onClick={() => onPress(i)} />
      ))}
    </View>
  )
}
