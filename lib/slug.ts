'use client';

/**
 * Генерирует URL-friendly slug из строки
 * @param str - Исходная строка
 * @returns slug вида "javascript-learn-the-basics"
 */
export function generateSlug(str: string): string {
  if (!str) return '';
  
  // Простая транслитерация для кириллицы
  const translitMap: Record<string, string> = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
    'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo',
    'Ж': 'Zh', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
    'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
    'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '',
    'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
  };
  
  // Применяем транслитерацию
  let slug = str.split('').map(char => translitMap[char] || char).join('');
  
  // Переводим в нижний регистр
  slug = slug.toLowerCase();
  
  // Заменяем пробелы и подчеркивания на дефисы
  slug = slug.replace(/[\s_]+/g, '-');
  
  // Удаляем всё, кроме букв, цифр и дефисов
  slug = slug.replace(/[^\w\-]/g, '');
  
  // Удаляем множественные дефисы
  slug = slug.replace(/\-{2,}/g, '-');
  
  // Удаляем дефисы в начале и конце
  slug = slug.replace(/^\-+|\-+$/g, '');
  
  // Ограничиваем длину 60 символами для красивости
  slug = slug.substring(0, 60);
  
  return slug;
}

/**
 * Проверяет, является ли строка UUID v4
 */
export function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
