/**
 * 防抖 composable — 搜索输入延迟触发
 */
import { ref, watch, type Ref } from 'vue'

/**
 * 对一个 ref 进行防抖，返回延迟后的值
 * @param source 原始 ref
 * @param ms 延迟毫秒数，默认 300
 */
export function useDebouncedRef<T>(source: Ref<T>, ms = 300): Ref<T> {
  const debounced = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout>

  watch(source, (val) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      debounced.value = val
    }, ms)
  })

  return debounced
}
