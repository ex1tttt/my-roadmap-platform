# ⚡ БЫСТРАЯ СПРАВКА: Все места для проверки is_private

## 🎯 ГЛАВНЫЕ ТОЧКИ ВМЕШАТЕЛЬСТВА

### 1️⃣ app/page.tsx (главная страница)
- **Строка:** 93-116
- **Проблема:** Загружает ВСЕ карточки
- **Решение:** Добавить `query = query.eq("is_private", false)` для неадминов

### 2️⃣ app/profile/[id]/page.tsx (публичный профиль)
- **Строка:** 48-58
- **Проблема:** Показывает все карточки профиля при открытии другим пользователем
- **Решение:** Условный фильтр если `!isOwner`

### 3️⃣ app/card/[slug]/page.tsx (детальная страница)
- **Строка:** 282
- **Проблема:** Админ не может видеть приватные карточки
- **Решение:** Добавить `!isAdmin` в условие доступа

### 4️⃣ app/liked/page.tsx (любимые)
- **Строка:** 48
- **Проблема:** Видны лайкнутые приватные карточки других
- **Решение:** `.or(is_private.eq.false,user_id.eq.${userId})`

### 5️⃣ app/feed/page.tsx (лента авторов)
- **Строка:** ~228
- **Проблема:** Видны приватные карточки в ленте
- **Решение:** `.eq("is_private", false)`

### 6️⃣ app/api/cards/route.ts (API)
- **Тип:** ДОБАВИТЬ GET метод
- **Проблема:** Нет API для получения карточек
- **Решение:** Новый GET с фильтром `is_private`

---

## 📂 Созданные документы

1. **[CARD_LOADING_ANALYSIS.md](CARD_LOADING_ANALYSIS.md)** - Полный анализ загрузки карточек
2. **[ADMIN_CHECK_IMPLEMENTATION_GUIDE.md](ADMIN_CHECK_IMPLEMENTATION_GUIDE.md)** - Детальный гайд с кодом
3. **[ADMIN_CHECK_QUICK_REFERENCE.md](ADMIN_CHECK_QUICK_REFERENCE.md)** - ЭТА ФАЙЛ

---

## 🔍 Ключевые Supabase запросы

### ❌ НЕПРАВИЛЬНО (загружает все):
```typescript
supabase.from("cards").select("*")
```

### ✅ ПРАВИЛЬНО (только публичные):
```typescript
supabase.from("cards").select("*").eq("is_private", false)
```

### ✅ ПРАВИЛЬНО (свои + публичные):
```typescript
supabase.from("cards").select("*")
  .or(`is_private.eq.false,user_id.eq.${userId}`)
```

### ✅ ПРАВИЛЬНО (админ видит все):
```typescript
// Если админ - не добавляем фильтр
if (!isAdmin) {
  query = query.eq("is_private", false);
}
```

---

## 💡 Примеры кода для copy-paste

### Получить статус админа (Client-side)
```typescript
import { supabase } from '@/lib/supabase';

const { data: { user } } = await supabase.auth.getUser();
const ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_IDS || "").split(",").filter(Boolean);
const isAdmin = user && ADMIN_IDS.includes(user.id);
```

### Получить статус админа (Server-side)
```typescript
import { createServerClient } from '@supabase/ssr';

const { data: { user } } = await supabaseServer.auth.getUser();
const ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_IDS || "").split(",").filter(Boolean);
const isAdmin = user && ADMIN_IDS.includes(user.id);
```

### Фильтр карточек в зависимости от админа
```typescript
let query = supabase.from("cards").select("*");

// Добавляем фильтр ТОЛЬКО если это НЕ админ
if (!isAdmin) {
  query = query.eq("is_private", false);
}

const { data: cards } = await query;
```

### Проверка доступа к приватной карточке
```typescript
const isOwner = card.user_id === currentUser?.id;
const isCollaborator = /* ... */;
const isAdmin = ADMIN_IDS.includes(currentUser?.id);

if (card.is_private && !isOwner && !isCollaborator && !isAdmin) {
  // Показать 403 Forbidden
}
```

---

## ⚙️ Конфигурация окружения

### .env.local (для development)
```
NEXT_PUBLIC_ADMIN_IDS=user-id-1,user-id-2,user-id-3
```

### Vercel (для production)
```
NEXT_PUBLIC_ADMIN_IDS = user-id-1,user-id-2,user-id-3
```

---

## 📊 Матрица доступа к карточкам

| Сценарий | Владелец | Коллаборатор | Админ | Другой |
|----------|----------|--------------|-------|--------|
| Публичная карточка | ✅ Да | ✅ Да | ✅ Да | ✅ Да |
| Приватная карточка | ✅ Да | ✅ Да | ✅ Да | ❌ Нет |
| На главной странице | ✅ Публичная | - | ✅ Все | ✅ Публичная |
| На публичном профиле | ✅ Все | - | ✅ Все | ✅ Публичная |
| В ленте авторов | ✅ Публичная | - | - | ✅ Публичная |
| В избранном | ✅ Публичная | - | - | ✅ Публичная |

---

## 🧪 Тестирование

### Тест 1: Главная страница
1. Создать приватную карточку под User A
2. Открыть главную как User B
3. **Ожидается:** Приватная карточка не видна

### Тест 2: Публичный профиль
1. Создать приватную карточку под User A
2. Открыть профиль User A как User B
3. **Ожидается:** Приватная карточка не видна

### Тест 3: Админ модерация
1. Создать приватную карточку под User A
2. Админ открывает детальную страницу
3. **Ожидается:** Приватная карточка видна для админа

### Тест 4: Ленты
1. User A создает приватную карточку
2. User B подписывается на User A
3. User B открывает ленту
4. **Ожидается:** Приватная карточка не видна в ленте

---

## 🔗 Связанные файлы

- Миграция БД: [db/migration_add_is_private_to_cards.sql](db/migration_add_is_private_to_cards.sql)
- RLS политика: [db/migration_cards_public_read_policy.sql](db/migration_cards_public_read_policy.sql)
- Компонент карточки: [components/Card.tsx](components/Card.tsx)

---

## ❓ FAQ

**Q: Что такое is_private?**
A: Флаг в таблице cards (true/false), определяет видна ли карточка публично

**Q: Кто может видеть приватные карточки?**
A: Владелец, коллабораторы, администраторы

**Q: Где проверяется is_private?**
A: На уровне приложения AND на уровне RLS политики БД

**Q: Нужна ли RLS?**
A: Да, для безопасности. Приложение не должно полагаться ТОЛЬКО на RLS

**Q: Как быть с админами?**
A: Они должны видеть все для модерации (исключение из RLS)

