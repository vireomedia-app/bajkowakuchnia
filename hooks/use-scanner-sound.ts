'use client'

import { useCallback, useEffect, useRef } from 'react'

export function useScannerSound() {
  const audioCtxRef = useRef<AudioContext | null>(null)
  const hasUserGestureRef = useRef(false)

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

  const unlockAudio = useCallback(async () => {
    hasUserGestureRef.current = true
    const ctx = getAudioContext()
    if (!ctx) return false

    try {
      // iOS Safari often requires resume + a tiny started source after gesture.
      if (ctx.state !== 'running') {
        await ctx.resume()
      }

      const buffer = ctx.createBuffer(1, 1, 22050)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start(0)
      source.stop(0)

      return ctx.state === 'running'
    } catch {
      return false
    }
  }, [getAudioContext])

  const ensureAudioReady = useCallback(async () => {
    if (!hasUserGestureRef.current) return null
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
    // Keep resume path in play functions for iOS edge-cases.
    const ctx = getAudioContext()
    if (!ctx) return
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
    } catch {
      return
    }
    if (!hasUserGestureRef.current) return

    // Double high beep that cuts through ambient kitchen noise.
    await playTone(950, 100, 'triangle', 0.22)
    await sleep(40)
    await playTone(1150, 100, 'triangle', 0.22)
  }, [getAudioContext, playTone, sleep])

  const playError = useCallback(async () => {
    // Keep resume path in play functions for iOS edge-cases.
    const ctx = getAudioContext()
    if (!ctx) return
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume()
      }
    } catch {
      return
    }
    if (!hasUserGestureRef.current) return

    // Triple low buzz for clear "attention needed" feedback.
    await playTone(150, 140, 'square', 0.24)
    await sleep(55)
    await playTone(145, 140, 'square', 0.24)
    await sleep(55)
    await playTone(140, 180, 'square', 0.24)
  }, [getAudioContext, playTone, sleep])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleFirstGesture = () => {
      void unlockAudio()
    }

    window.addEventListener('pointerdown', handleFirstGesture, { passive: true })
    window.addEventListener('touchstart', handleFirstGesture, { passive: true })
    window.addEventListener('click', handleFirstGesture, { passive: true })
    window.addEventListener('keydown', handleFirstGesture)

    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture)
      window.removeEventListener('touchstart', handleFirstGesture)
      window.removeEventListener('click', handleFirstGesture)
      window.removeEventListener('keydown', handleFirstGesture)
    }
  }, [unlockAudio])

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {})
        audioCtxRef.current = null
      }
    }
  }, [])

  return {
    unlockAudio,
    playSuccess,
    playError,
  }
}
