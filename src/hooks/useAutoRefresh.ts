'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseAutoRefreshOptions {
  enabled?: boolean;
  interval?: number; // 毫秒，默认10秒
  onRefresh?: () => void | Promise<void>;
}

export function useAutoRefresh({
  enabled = true,
  interval = 10000,
  onRefresh,
}: UseAutoRefreshOptions = {}) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  const start = useCallback(() => {
    if (!enabled) return;
    
    // 先停止现有的定时器
    stop();
    
    // 设置新的定时器
    intervalRef.current = setInterval(async () => {
      if (isRefreshingRef.current) return; // 防止重复刷新
      
      isRefreshingRef.current = true;
      try {
        await onRefresh?.();
      } catch (error) {
        console.error('Auto refresh error:', error);
      } finally {
        isRefreshingRef.current = false;
      }
    }, interval);
  }, [enabled, interval, onRefresh]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const refreshNow = useCallback(async () => {
    if (isRefreshingRef.current) return;
    
    isRefreshingRef.current = true;
    try {
      await onRefresh?.();
    } catch (error) {
      console.error('Manual refresh error:', error);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [onRefresh]);

  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }

    return () => stop();
  }, [enabled, start, stop]);

  return {
    start,
    stop,
    refreshNow,
    isRefreshing: isRefreshingRef.current,
  };
}
