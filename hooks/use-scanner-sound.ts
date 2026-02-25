'use client'

import { useCallback, useEffect, useRef } from 'react'

export function useScannerSound() {
  const audioCtxRef = useRef<AudioContext | null>(null)

  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const Ctx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return null
      audioCtxRef.current = new Ctx()
    }
    return audioCtxRef.current
  }, [])

  const ensureAudioReady = useCallback(async () => {
    const ctx = getAudioContext()
    if (!ctx) return null

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        return null
      }
    }

    return ctx.state === 'running' ? ctx : null
  }, [getAudioContext])

  const sleep = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms)
    })
  }, [])

  const playTone = useCallback(
    async (frequency: number, durationMs: number, type: OscillatorType, volume = 0.2) => {
      const ctx = await ensureAudioReady()
      if (!ctx) return

      try {
        const oscillator = ctx.createOscillator()
        const gainNode = ctx.createGain()

        oscillator.type = type
        oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)

        gainNode.gain.setValueAtTime(0.0001, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + 0.008)
        gainNode.gain.exponentialRampToValueAtTime(
          0.0001,
          ctx.currentTime + durationMs / 1000,
        )

        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)

        oscillator.start()
        oscillator.stop(ctx.currentTime + durationMs / 1000 + 0.02)
      } catch {
        // Silent fail: sound feedback is optional UX enhancement.
      }
    },
    [ensureAudioReady],
  )

  const playSuccess = useCallback(async () => {
    // Double high beep that cuts through ambient kitchen noise.
    await playTone(950, 100, 'triangle', 0.22)
    await sleep(40)
    await playTone(1150, 100, 'triangle', 0.22)
  }, [playTone, sleep])

  const playError = useCallback(async () => {
    // Triple low buzz for clear "attention needed" feedback.
    await playTone(150, 140, 'square', 0.24)
    await sleep(55)
    await playTone(145, 140, 'square', 0.24)
    await sleep(55)
    await playTone(140, 180, 'square', 0.24)
  }, [playTone, sleep])

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
    }
  }, [])

  return {
    playSuccess,
    playError,
  }
}
