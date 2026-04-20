# Анализ загрузки и фильтрации карточек по is_private

## 📊 Найденные места для фильтрации by is_private

### 1️⃣ ГЛАВНАЯ СТРАНИЦА - app/page.tsx
**Файл:** [app/page.tsx](app/page.tsx)

**Проблема:** Загружаются ВСЕ карточки без фильтра по is_private

**Строки для добавления логики:** 93-116
```
// Строка 93-100: Базовый запрос карточек
let query = supabase
  .from("cards")
  .select("*", { count: 'exact' });

//需要добавить ЗДЕСЬ проверку:
// Если пользователь НЕ администратор - добавить фильтр is_private = false
```

**Текущий код:**
```typescript
let query = supabase
  .from("cards")
  .select("*", { count: 'exact' });

if (debouncedQuery) {
  query = query.ilike("title", `%${debouncedQuery}%`);
}
if (activeCategory) {
  query = query.eq("category", activeCategory);
}
```

---

### 2️⃣ ПУБЛИЧНЫЙ ПРОФИЛЬ - app/profile/[id]/page.tsx
**Файл:** [app/profile/[id]/page.tsx](app/profile/[id]/page.tsx)

**Проблема:** При загрузке публичного профиля (не владельца) показываются ВСЕ карточки пользователя, включая приватные

**Строки для добавления логики:** 48-58
```
// Текущий код (без фильтра):
const [
  { data: profile },
  { data: cards },  // ← ЗДЕСЬ ПРОБЛЕМА!
  ...
] = await Promise.all([
  supabaseServer.from("profiles").select("id, username, avatar, bio").eq("id", id).maybeSingle(),
  supabaseServer
    .from("cards")
    .select("*, steps(*)")
    .eq("user_id", id)  // ← Загружает ВСЕ карточки
    .order("created_at", { ascending: false }),
  ...
]);
```

**Нужно добавить:**
```typescript
// Если не владелец профиля и не админ - добавить фильтр
if (!isOwner && !isAdmin) {
  cardQuery = cardQuery.eq("is_private", false);
}
// Или администратор видит все
```

---

### 3️⃣ ЛИЧНЫЙ ПРОФИЛЬ - app/profile/page.tsx
**Файл:** [app/profile/page.tsx](app/profile/page.tsx)

**Проблема:** Загружаются собственные карточки (включая приватные) - это OK, но нужно проверить для shared carточек

**Строки для добавления логики:** 84-90
```typescript
// Строка 84-90:
const [myCardsRes, followersRes, followingRes] = await Promise.all([
  supabase.from('cards').select('*').order('created_at', { ascending: false }).eq('user_id', userId),
  // это OK - свои карточки, включая приватные
  // Но нужно проверить shared карточки
]);
```

---

### 4️⃣ ЛЕНТА - app/feed/page.tsx  
**Файл:** [app/feed/page.tsx](app/feed/page.tsx)

**Проблема:** Нужно проверить, какие карточки загружаются в ленте

**Строки для проверки:** начало файла
```typescript
// Нужно найти запрос к базе в этом файле для карточек
// и добавить фильтр is_private = false для неадминов
```

---

### 5️⃣ ИЗБРАННЫЕ КАРТОЧКИ - app/liked/page.tsx
**Файл:** [app/liked/page.tsx](app/liked/page.tsx)

**Проблема:** Загружаются карточки которые пользователь лайкнул, но может показывать приватные карточки

**Строки для добавления логики:** 48
```typescript
// Строка 48:
const [cardsRes, stepsRes, likesCountRes, userFavsRes, profilesAll] = await Promise.all([
  supabase.from("cards").select("*").order("created_at", { ascending: false }).in("id", cardIds),
  // ← ЗДЕСЬ: нужно добавить фильтр по is_private если пользователь НЕ админ или не владелец
]);
```

---

### 6️⃣ ДЕТАЛЬНАЯ СТРАНИЦА КАРТОЧКИ - app/card/[slug]/page.tsx
**Файл:** [app/card/[slug]/page.tsx](app/card/[slug]/page.tsx)

**Проблема:** Уже есть проверка на is_private, но нужно добавить исключение для администраторов

**Строки с текущей проверкой:** 282
```typescript
if (!data || (data.is_private && (!currentUser || (currentUser.id !== data.user_id && !isCollaborator)))) {
  // Вернуть ошибку доступа
}
```

**Нужно добавить:** Проверка админа перед проверкой is_private
```typescript
const isAdmin = ADMIN_IDS.includes(currentUser?.id);
if (!data || (data.is_private && (!currentUser || (currentUser.id !== data.user_id && !isCollaborator && !isAdmin)))) {
  // Вернуть ошибку доступа
}
```

---

### 7️⃣ API ENDPOINT - app/api/cards/route.ts
**Файл:** [app/api/cards/route.ts](app/api/cards/route.ts)

**Проблема:** Нет GET метода для получения карточек! Есть только POST для создания

**Действие:** Нужно добавить GET метод для получения карточек с фильтром по is_private:
```typescript
export async function GET(req: NextRequest) {
  // Получить текущего пользователя
  // Проверить если администратор
  // Если НЕ админ - добавить условие is_private = false
  // Вернуть карточки
}
```

---

### 8️⃣ КОМПОНЕНТ ВЫВОДА - components/Card.tsx
**Файл:** [components/Card.tsx](components/Card.tsx)

**Строки:** 215
```typescript
// Линия 35, 215: Интерфейсы и вывод
interface CardType {
  ...
  is_private?: boolean;
};

// Строка 215: Вывод иконки замка для приватных карточек
{card.is_private && (
  <Lock size={18} className="text-amber-500" />
)}
```

**Статус:** ✅ OK - компонент только выводит, фильтрация должна быть на уровне загрузки

---

## 🎯 РЕЗЮМЕ: Где нужно добавить проверку администратора

| # | Файл | Строки | Тип | Приоритет |
|---|------|--------|-----|-----------|
| 1 | `app/page.tsx` | 93-116 | Фильтр запроса | 🔴 Высокий |
| 2 | `app/profile/[id]/page.tsx` | 48-58 | Условный фильтр | 🔴 Высокий |
| 3 | `app/card/[slug]/page.tsx` | 282 | Проверка доступа | 🔴 Высокий |
| 4 | `app/liked/page.tsx` | 48 | Фильтр запроса | 🟠 Средний |
| 5 | `app/feed/page.tsx` | - | Найти & добавить | 🟠 Средний |
| 6 | `app/profile/page.tsx` | 84-90 | Проверка shared | 🟡 Низкий |
| 7 | `app/api/cards/route.ts` | - | Добавить GET | 🔴 Высокий |
| 8 | `components/Card.tsx` | 215 | ✅ OK | - |

---

## 📝 Пример логики для добавления

```typescript
// 1. Получить текущего пользователя и его статус админа
const { data: { user: currentUser } } = await supabaseAuth.auth.getUser();
const isAdmin = currentUser && ADMIN_IDS.includes(currentUser.id);

// 2. Если пользователь НЕ админ - добавить фильтр
let query = supabaseAuth.from("cards").select("*");

if (!isAdmin) {
  query = query.eq("is_private", false);
}

// 3. Или для конкретной проверки доступа к приватной карточке:
if (card.is_private && (!currentUser || (
  currentUser.id !== card.user_id && 
  !isCollaborator && 
  !isAdmin  // ← Добавить эту проверку
))) {
  // Вернуть 403 Forbidden
}
```

---

## ⚠️ Важные замечания

1. **ADMIN_IDS** нужно получать из переменной окружения или базы данных
2. **RLS политика** в базе должна быть настроена, но приложение должно учитывать это на уровне запросов
3. **Публичный профиль** должен показывать только публичные карточки (is_private = false)
4. **Личный кабинет** может показывать все свои карточки, включая приватные
5. **Администраторы** должны видеть все карточки везде (для модерации и контроля)

