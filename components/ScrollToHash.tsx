"use client";

import { useEffect } from "react";

/**
 * Клиентский компонент: при монтировании проверяет window.location.hash
 * и плавно прокручивает к нужному якорю.
 */
export default function ScrollToHash() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) {
      // Небольшая задержка, чтобы DOM точно прорисовался
      setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, []);

  return null;
}
