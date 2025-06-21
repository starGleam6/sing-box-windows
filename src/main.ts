import './assets/main.css'

import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { usePinia } from '@/stores'
import i18n from './locales'
import { storeManager } from './stores/StoreManager'
import { memoryLeakDetector, webSocketCleaner, StoreCleaner } from '@/utils/memory-leak-fix'

// 导入性能优化工具
import { memoryMonitor, componentPreloader, eventListenerManager } from '@/utils/performance'
import { bundleAnalyzer } from '@/utils/bundleAnalyzer'
import { codeSplittingManager } from '@/utils/codeSplitting'

const app = createApp(App)

// 设置Pinia状态管理
usePinia(app)

// 设置路由
app.use(router)

// 设置国际化
app.use(i18n)

// 初始化Store管理器
storeManager.initialize()

// 启动内存泄露监控（开发环境下更频繁）
const isDev = import.meta.env.DEV
memoryLeakDetector.startMonitoring(isDev ? 15000 : 30000) // 开发环境15秒，生产环境30秒

// 设置应用关闭时的清理逻辑
window.addEventListener('beforeunload', async () => {
  console.log('🧹 应用关闭，执行清理...')

  // 销毁WebSocketService实例
  try {
    const { WebSocketService } = await import('@/services/websocket-service')
    WebSocketService.destroyInstance()
  } catch (error) {
    console.error('WebSocketService清理失败:', error)
  }

  // 停止内存监控
  memoryLeakDetector.stopMonitoring()

  // 清理所有WebSocket连接和定时器
  webSocketCleaner.cleanupAll()

  // 清理所有Store
  StoreCleaner.cleanupAll()

  // 清理内存优化器
  try {
    const { MemoryOptimizer } = await import('@/utils/memory-optimization')
    MemoryOptimizer.getInstance().cleanup()
  } catch (error) {
    console.error('内存优化器清理失败:', error)
  }

  // 清理性能优化工具资源
  if (isDev) {
    memoryMonitor.stopMonitoring()
    componentPreloader.destroy()
    eventListenerManager.cleanup()
    codeSplittingManager.cleanup()
    bundleAnalyzer.printReport()
  }
})

// 开发环境下添加全局调试方法
if (isDev) {
  // @ts-expect-error - 开发环境调试方法
  window.debugMemory = {
    checkMemory: () => memoryLeakDetector.forceCheck(),
    getStats: () => memoryLeakDetector.getMemoryStats(),
    cleanupAll: () => {
      webSocketCleaner.cleanupAll()
      StoreCleaner.cleanupAll()
    },
  }
}

// 性能优化初始化
if (import.meta.env.DEV) {
  console.log('🚀 开发环境性能优化工具已启用')

  // 启动内存监控（与内存泄露检测协同工作）
  memoryMonitor.startMonitoring(15000) // 每15秒监控一次

  // 预加载关键组件
  componentPreloader.preloadComponent('HomeView').catch(console.error)

  // 输出初始化信息
  console.log('📊 性能监控工具状态:')
  console.log('- 内存泄露检测: 已启动')
  console.log('- 内存监控: 已启动')
  console.log('- 组件预加载器: 已启动')
  console.log('- Bundle分析器: 已启动')
  console.log('- 代码分割管理器: 已启动')
  console.log('- 事件监听器管理: 已启动')
}

// 应用挂载
app.mount('#app')

// 应用性能测量
const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

if (navigationEntry) {
  const domContentLoaded =
    navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart
  const loadComplete = navigationEntry.loadEventEnd - navigationEntry.loadEventStart

  console.log('⚡ 应用性能指标:')
  console.log(`- DOMContentLoaded: ${domContentLoaded.toFixed(2)}ms`)
  console.log(`- Load Complete: ${loadComplete.toFixed(2)}ms`)
  console.log(
    `- DNS Lookup: ${(navigationEntry.domainLookupEnd - navigationEntry.domainLookupStart).toFixed(2)}ms`,
  )
  console.log(
    `- TCP Connect: ${(navigationEntry.connectEnd - navigationEntry.connectStart).toFixed(2)}ms`,
  )
}

// 错误边界
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue应用错误:', err)
  console.error('错误信息:', info)
  console.error('组件实例:', instance)

  // 可以在这里发送错误报告到监控服务
  if (import.meta.env.PROD) {
    // 生产环境错误报告
    // reportError(err, instance, info)
  }
}

// 全局属性（仅开发环境）
if (import.meta.env.DEV) {
  app.config.globalProperties.$performance = {
    memoryMonitor,
    bundleAnalyzer,
    codeSplittingManager,
    componentPreloader,
    eventListenerManager,
  }

  // 暴露到window对象方便调试
  const performanceTools = {
    memoryMonitor,
    bundleAnalyzer,
    codeSplittingManager,
    componentPreloader,
    eventListenerManager,
  }

  Object.defineProperty(window, '__PERF_TOOLS__', {
    value: performanceTools,
    writable: false,
    configurable: false,
  })

  console.log('🔧 性能工具已挂载到 window.__PERF_TOOLS__')
}
