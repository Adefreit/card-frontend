/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface GamesCartItem {
  gameId: string;
  gameName: string;
  priceId: string;
  unitAmountCents: number;
  currency: string;
  quantity: number;
}

interface GamesCartContextType {
  items: GamesCartItem[];
  addItem: (item: GamesCartItem) => void;
  removeItem: (gameId: string) => void;
  updateQuantity: (gameId: string, quantity: number) => void;
  clearCart: () => void;
}

const GamesCartContext = createContext<GamesCartContextType | undefined>(
  undefined,
);

const GAMES_CART_STORAGE_KEY = "games.cart.items";

export function useGamesCart() {
  const ctx = useContext(GamesCartContext);
  if (!ctx)
    throw new Error("useGamesCart must be used within GamesCartProvider");
  return ctx;
}

export function GamesCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<GamesCartItem[]>(() => {
    try {
      const raw = localStorage.getItem(GAMES_CART_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as GamesCartItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(GAMES_CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (item: GamesCartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.gameId === item.gameId);
      if (existing) {
        return prev.map((i) =>
          i.gameId === item.gameId
            ? {
                ...i,
                quantity: i.quantity + item.quantity,
                currency: item.currency,
              }
            : i,
        );
      }
      return [...prev, item];
    });
  };

  const removeItem = (gameId: string) => {
    setItems((prev) => prev.filter((i) => i.gameId !== gameId));
  };

  const updateQuantity = (gameId: string, quantity: number) => {
    if (!Number.isFinite(quantity) || quantity < 1) {
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.gameId === gameId ? { ...i, quantity } : i)),
    );
  };

  const clearCart = () => setItems([]);

  return (
    <GamesCartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart }}
    >
      {children}
    </GamesCartContext.Provider>
  );
}
