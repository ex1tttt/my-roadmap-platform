# МЕСТА ДЛЯ ДОБАВЛЕНИЯ ПРОВЕРКИ АДМИНИСТРАТОРА - Детальный справочник

## 📍 МЕСТО 1: Главная страница - app/page.tsx

**Файл:** [app/page.tsx](app/page.tsx#L93)
**Строки:** 93-116  
**Тип:** Client-side Supabase запрос

### Текущий код (НЕПРАВИЛЬНЫЙ):
```typescript
async function fetchData() {
  setLoading(true);
  setError(null);
  try {
    // Базовый запрос карточек - загружает все!
    let query = supabase
      .from("cards")
      .select("*", { count: 'exact' });
    
    if (debouncedQuery) {
      query = query.ilike("title", `%${debouncedQuery}%`);
    }
    if (activeCategory) {
      query = query.eq("category", activeCategory);
    }
    
    // Сортируем по дате по умолчанию
    query = query.order("created_at", { ascending: false });
    
    // Применяем pagination
    query = query.range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);

    const { data: cardsData, error: cardsError, count } = await query;
```

### Что нужно исправить:
❌ **ПРОБЛЕМА:** Загружаются ВСЕ карточки, включая приватные (is_private = true)

✅ **РЕШЕНИЕ:** Нужно добавить фильтр после line 95 (после `.select("*", ...)`):
```typescript
// Добавить проверку:
if (!userId) {
  // Неавторизованный пользователь видит только публичные
  query = query.eq("is_private", false);
} else {
  // Авторизованный НЕ-админ видит только публичные
  // (админы будут видеть все благодаря RLS)
  const { data: adminCheck } = await supabase
    .from("admin_access")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  
  if (!adminCheck) {
    query = query.eq("is_private", false);
  }
}
```

---

## 📍 МЕСТО 2: Публичный профиль - app/profile/[id]/page.tsx

**Файл:** [app/profile/[id]/page.tsx](app/profile/[id]/page.tsx#L48-L58)
**Строки:** 48-58  
**Тип:** Server-side (async Server Component)

### Текущий код (НЕПРАВИЛЬНЫЙ):
```typescript
const [
  { data: profile },
  { data: cards },  // ← ЗАГРУЖАЕТ ВСЕ!
  { data: { user: currentUser } },
  { count: followersCount },
  { count: followingCount },
] = await Promise.all([
  supabaseServer.from("profiles").select("id, username, avatar, bio").eq("id", id).maybeSingle(),
  supabaseServer
    .from("cards")
    .select("*, steps(*)")
    .eq("user_id", id)  // ← ВСЕ карточки!
    .order("created_at", { ascending: false }),
  supabaseAuth.auth.getUser(),
  ...
]);

const isOwner = currentUser?.id === id;
```

### Что нужно исправить:
❌ **ПРОБЛЕМА:** Показывает все карточки профиля, даже если они приватные и пользователь - не владелец и не админ

✅ **РЕШЕНИЕ:** Добавить условный фильтр:
```typescript
// ЗАМЕНА линий 48-58:

let cardQuery = supabaseServer
  .from("cards")
  .select("*, steps(*)")
  .eq("user_id", id)
  .order("created_at", { ascending: false });

// Получаем текущего пользователя параллельно
const [userResult] = await Promise.all([supabaseAuth.auth.getUser()]);
const currentUser = userResult.data?.user;
const isOwner = currentUser?.id === id;

// Если не владелец - добавляем фильтр публичных
if (!isOwner) {
  cardQuery = cardQuery.eq("is_private", false);
}

const [
  { data: profile },
  { data: cards },
  { data: { user: currentUserData } },
  { count: followersCount },
  { count: followingCount },
] = await Promise.all([
  supabaseServer.from("profiles").select("id, username, avatar, bio").eq("id", id).maybeSingle(),
  cardQuery,
  supabaseAuth.auth.getUser(),
  ...
]);
```

---

## 📍 МЕСТО 3: Детальная страница карточки - app/card/[slug]/page.tsx

**Файл:** [app/card/[slug]/page.tsx](app/card/[slug]/page.tsx#L275-L290)
**Строки:** 275-290  
**Тип:** Server-side проверка доступа

### Текущий код (НЕПОЛНЫЙ):
```typescript
// Строка 282:
if (!data || (data.is_private && (!currentUser || (currentUser.id !== data.user_id && !isCollaborator)))) {
  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] py-12 px-4 sm:px-6">
      <main className="mx-auto max-w-4xl">
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-10 text-center text-slate-500 dark:text-slate-400">
          Карточка с таким ID не найдена.
        </div>
      </main>
    </div>
  );
}
```

### Что нужно исправить:
❌ **ПРОБЛЕМА:** Администраторы не могут видеть приватные карточки для проверки/модерации

✅ **РЕШЕНИЕ:** Добавить проверку админа:
```typescript
// ЗАМЕНА линии 282:

// Определяем админа
const ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_IDS || "").split(",").filter(Boolean);
const isAdmin = currentUser && ADMIN_IDS.includes(currentUser.id);

// Правильная проверка доступа:
if (!data || (data.is_private && (!currentUser || (
  currentUser.id !== data.user_id && 
  !isCollaborator && 
  !isAdmin  // ← ДОБАВИТЬ эту проверку
)))) {
  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] py-12 px-4 sm:px-6">
      <main className="mx-auto max-w-4xl">
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-10 text-center text-slate-500 dark:text-slate-400">
          Карточка с таким ID не найдена.
        </div>
      </main>
    </div>
  );
}
```

---

## 📍 МЕСТО 4: Любимые карточки - app/liked/page.tsx

**Файл:** [app/liked/page.tsx](app/liked/page.tsx#L48)
**Строки:** 48  
**Тип:** Client-side запрос

### Текущий код (НЕПРАВИЛЬНЫЙ):
```typescript
const cardIds = likesData.map((l: any) => l.card_id);

const [cardsRes, stepsRes, likesCountRes, userFavsRes, profilesAll] = await Promise.all([
  supabase.from("cards").select("*").order("created_at", { ascending: false }).in("id", cardIds),
  // ← Загружает все карточки, включая приватные других пользователей
  supabase.from("steps").select("*").in("card_id", cardIds).order("order", { ascending: true }),
  ...
]);
```

### Что нужно исправить:
❌ **ПРОБЛЕМА:** Пользователь видит лайкнутые им приватные карточки других людей

✅ **РЕШЕНИЕ:** Добавить фильтр:
```typescript
// ЗАМЕНА линии 48:

const cardIds = likesData.map((l: any) => l.card_id);

const [cardsRes, stepsRes, likesCountRes, userFavsRes, profilesAll] = await Promise.all([
  // ДОБАВИТЬ условие для приватных карточек:
  supabase
    .from("cards")
    .select("*")
    .order("created_at", { ascending: false })
    .in("id", cardIds)
    // Показываем публичные ИЛИ принадлежащие текущему пользователю
    .or(`is_private.eq.false,user_id.eq.${user.id}`),
  supabase.from("steps").select("*").in("card_id", cardIds).order("order", { ascending: true }),
  ...
]);
```

---

## 📍 МЕСТО 5: Лента авторов - app/feed/page.tsx

**Файл:** [app/feed/page.tsx](app/feed/page.tsx#L228)
**Строки:** ~228  
**Тип:** Client-side запрос

### Текущий код (НЕПРАВИЛЬНЫЙ):
```typescript
const { data: cardsData, error: cardsError } = await supabase
  .from("cards")
  .select("*")
  .in("user_id", followingIds)  // ← От авторов, на которых подписан
  .order("created_at", { ascending: false });
  // ← Но загружает ВСЕ карточки, включая приватные!
```

### Что нужно исправить:
❌ **ПРОБЛЕМА:** В ленте видны приватные карточки авторов

✅ **РЕШЕНИЕ:** Добавить фильтр публичных карточек:
```typescript
// ЗАМЕНА:
const { data: cardsData, error: cardsError } = await supabase
  .from("cards")
  .select("*")
  .in("user_id", followingIds)
  .eq("is_private", false)  // ← ДОБАВИТЬ: только публичные
  .order("created_at", { ascending: false });
```

---

## 📍 МЕСТО 6: Личный кабинет - app/profile/page.tsx

**Файл:** [app/profile/page.tsx](app/profile/page.tsx#L84)
**Строки:** 84-90  
**Тип:** Client-side запрос

### Текущий код (ПРАВИЛЬНЫЙ):
```typescript
const [myCardsRes, followersRes, followingRes] = await Promise.all([
  supabase.from('cards').select('*').order('created_at', { ascending: false }).eq('user_id', userId),
  // ✅ OK: Загружаются свои карточки, включая приватные
  ...
]);
```

### Статус:
✅ **НЕ ТРЕБУЕТ ИЗМЕНЕНИЙ** - пользователь видит свои карточки включая приватные

---

## 📍 МЕСТО 7: API Endpoint - app/api/cards/route.ts

**Файл:** [app/api/cards/route.ts](app/api/cards/route.ts)
**Строки:** 1-200 (весь файл)  
**Тип:** Server API

### Текущее состояние:
❌ **ПРОБЛЕМА:** Есть только POST метод для создания карточек. НЕ существует GET метода!

### Что нужно добавить:
**Нужно добавить новый GET метод:**

```typescript
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    // Получаем текущего пользователя
    const cookieStore = await cookies();
    const supabaseServer = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    const { data: { user } } = await supabaseServer.auth.getUser();
    
    // Проверяем администратора
    let query = supabaseAdmin.from('cards').select('*', { count: 'exact' });
    
    // Если НЕ админ - добавляем фильтр публичных
    if (!user || !ADMIN_IDS.includes(user.id)) {
      query = query.eq('is_private', false);
    }
    
    // Применяем фильтры
    if (category) {
      query = query.eq('category', category);
    }
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }
    
    // Применяем сортировку и pagination
    query = query.order('created_at', { ascending: false });
    query = query.range(offset, offset + limit - 1);

    const { data: cards, count, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      cards: cards || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('[CARDS GET] API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 🔑 КОНСТАНТА АДМИНИСТРАТОРОВ

**Нужна везде:** Переменная `ADMIN_IDS` для проверки администратора

### Решение 1: Из переменной окружения
```typescript
const ADMIN_IDS = (process.env.NEXT_PUBLIC_ADMIN_IDS || "").split(",").filter(Boolean);
const isAdmin = currentUser && ADMIN_IDS.includes(currentUser.id);
```

### Решение 2: Из таблицы БД (более гибко)
```typescript
const { data: adminCheck } = await supabase
  .from('admin_access')
  .select('id')
  .eq('user_id', currentUser.id)
  .maybeSingle();

const isAdmin = !!adminCheck;
```

### Рекомендуется:
**Создать файл:** `lib/admin.ts`
```typescript
export const ADMIN_IDS = process.env.NEXT_PUBLIC_ADMIN_IDS?.split(',').filter(Boolean) || [];

export function isAdmin(userId: string | undefined): boolean {
  return userId ? ADMIN_IDS.includes(userId) : false;
}
```

Затем использовать везде:
```typescript
import { isAdmin } from '@/lib/admin';
// ...
if (isAdmin(currentUser?.id)) {
  // Показать приватные
}
```

---

## 📋 Чек-лист для реализации

- [ ] МЕСТО 1: app/page.tsx - добавить фильтр is_private
- [ ] МЕСТО 2: app/profile/[id]/page.tsx - условный фильтр для не-владельцев
- [ ] МЕСТО 3: app/card/[slug]/page.tsx - добавить проверку админа
- [ ] МЕСТО 4: app/liked/page.tsx - фильтр по is_private
- [ ] МЕСТО 5: app/feed/page.tsx - только публичные карточки
- [ ] МЕСТО 7: app/api/cards/route.ts - добавить GET метод с фильтром
- [ ] Создать lib/admin.ts с проверкой админа
- [ ] Установить NEXT_PUBLIC_ADMIN_IDS в .env.local

