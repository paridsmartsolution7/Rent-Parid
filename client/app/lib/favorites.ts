"use client";

import Cookies from "js-cookie";

const STORAGE_KEY = "favorites";
const EVENT_NAME = "favorites:changed";

function isAuthenticated(): boolean {
  return !!Cookies.get("auth_token");
}

// Get favorites from localStorage
function getLocalFavorites(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}

// Set favorites to localStorage
function setLocalFavorites(favorites: number[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
}

// Fetch favorites from database (for authenticated users)
export async function fetchFavoritesFromDB(): Promise<number[]> {
  if (!isAuthenticated()) return getLocalFavorites();
  
  try {
    const res = await fetch("/api/favorites");
    const data = await res.json();
    
    if (data.success && Array.isArray(data.favorites)) {
      // Sync with localStorage
      setLocalFavorites(data.favorites);
      return data.favorites;
    }
  } catch (err) {
    console.error("Failed to fetch favorites from DB:", err);
  }
  
  return getLocalFavorites();
}

// Get favorites (from localStorage, but should call fetchFavoritesFromDB for fresh data)
export function getFavorites(): number[] {
  return getLocalFavorites();
}

export function isFavorite(id: number): boolean {
  return getFavorites().includes(id);
}

// Toggle favorite (syncs with database if authenticated)
export async function toggleFavorite(id: number): Promise<boolean> {
  const current = getLocalFavorites();
  const idx = current.indexOf(id);
  let nowFavorite: boolean;
  
  if (idx >= 0) {
    // Remove from favorites
    current.splice(idx, 1);
    nowFavorite = false;
    
    // Sync with database if authenticated
    if (isAuthenticated()) {
      try {
        await fetch(`/api/favorites?product_id=${id}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Failed to remove favorite from DB:", err);
      }
    }
  } else {
    // Add to favorites
    current.push(id);
    nowFavorite = true;
    
    // Sync with database if authenticated
    if (isAuthenticated()) {
      try {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_id: id }),
        });
      } catch (err) {
        console.error("Failed to add favorite to DB:", err);
      }
    }
  }
  
  setLocalFavorites(current);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
  return nowFavorite;
}

// Remove favorite (syncs with database if authenticated)
export async function removeFavorite(id: number): Promise<void> {
  const current = getLocalFavorites().filter((x) => x !== id);
  setLocalFavorites(current);
  
  // Sync with database if authenticated
  if (isAuthenticated()) {
    try {
      await fetch(`/api/favorites?product_id=${id}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to remove favorite from DB:", err);
    }
  }
  
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function onFavoritesChanged(handler: () => void): () => void {
  const wrapped = () => handler();
  window.addEventListener(EVENT_NAME, wrapped);
  window.addEventListener("storage", wrapped);
  return () => {
    window.removeEventListener(EVENT_NAME, wrapped);
    window.removeEventListener("storage", wrapped);
  };
}
