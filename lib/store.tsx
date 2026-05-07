'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface StoredProduct {
  id: string       // `${memberId}__${productName}`
  name: string
  memberId: string
  memberName: string
}

interface StoreContextType {
  favorites: StoredProduct[]
  cart: StoredProduct[]
  toggleFavorite: (product: StoredProduct) => void
  isFavorite: (id: string) => boolean
  addToCart: (product: StoredProduct) => void
  removeFromCart: (id: string) => void
  isInCart: (id: string) => boolean
  clearCart: () => void
}

const StoreContext = createContext<StoreContextType | null>(null)

function readLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeLS<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore quota errors
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<StoredProduct[]>([])
  const [cart, setCart] = useState<StoredProduct[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setFavorites(readLS<StoredProduct[]>('cm_favorites', []))
    setCart(readLS<StoredProduct[]>('cm_cart', []))
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted) writeLS('cm_favorites', favorites)
  }, [favorites, mounted])

  useEffect(() => {
    if (mounted) writeLS('cm_cart', cart)
  }, [cart, mounted])

  function toggleFavorite(product: StoredProduct) {
    setFavorites(prev => {
      const exists = prev.some(p => p.id === product.id)
      return exists ? prev.filter(p => p.id !== product.id) : [...prev, product]
    })
  }

  function isFavorite(id: string) {
    return favorites.some(p => p.id === id)
  }

  function addToCart(product: StoredProduct) {
    setCart(prev => prev.some(p => p.id === product.id) ? prev : [...prev, product])
  }

  function removeFromCart(id: string) {
    setCart(prev => prev.filter(p => p.id !== id))
  }

  function isInCart(id: string) {
    return cart.some(p => p.id === id)
  }

  function clearCart() {
    setCart([])
  }

  return (
    <StoreContext.Provider value={{
      favorites,
      cart,
      toggleFavorite,
      isFavorite,
      addToCart,
      removeFromCart,
      isInCart,
      clearCart,
    }}>
      {children}
    </StoreContext.Provider>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
