-- =============================================================================
-- Закрытие утечек RLS: приватные карточки и связанные данные
-- (аноним не должен читать комментарии/шаги/ресурсы/лайки к приватной карте,
--  а также список соавторов и лайки комментариев без доступа к карточке).
--
-- Выполнить в Supabase → SQL Editor. При конфликте имён политик — поправьте DROP.
-- =============================================================================

-- Доступ к карточке для SELECT (совпадает с логикой cards: публичная | владелец | коллаборатор)
CREATE OR REPLACE FUNCTION public.card_is_visible(c_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cards c
    WHERE c.id = c_id
      AND (
        c.is_private = false
        OR c.is_private IS NULL
        OR (auth.uid() IS NOT NULL AND c.user_id = auth.uid())
        OR (
          auth.email() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.card_collaborators cc
            WHERE cc.card_id = c.id
              AND cc.user_email = auth.email()
          )
        )
      )
  );
$$;

-- Вставка/изменение шагов и ресурсов: владелец или редактор по карточке
CREATE OR REPLACE FUNCTION public.card_is_editable(c_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cards c
    WHERE c.id = c_id
      AND (
        c.user_id = auth.uid()
        OR (
          auth.email() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.card_collaborators cc
            WHERE cc.card_id = c.id
              AND cc.role = 'editor'
              AND cc.user_email = auth.email()
          )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.card_is_visible(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.card_is_editable(uuid) TO anon, authenticated;

-- ─── comments ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select_visible_card" ON public.comments
  FOR SELECT USING (public.card_is_visible(roadmap_id));

DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert_visible_card" ON public.comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.card_is_visible(roadmap_id)
  );

DROP POLICY IF EXISTS "comments_delete" ON public.comments;
CREATE POLICY "comments_delete" ON public.comments
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "comments_update_by_card_owner" ON public.comments;
CREATE POLICY "comments_update_by_card_owner" ON public.comments
  FOR UPDATE
  USING (
    auth.uid() = (SELECT c.user_id FROM public.cards c WHERE c.id = comments.roadmap_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT c.user_id FROM public.cards c WHERE c.id = comments.roadmap_id)
  );

-- ─── comment_likes / comment_dislikes ──────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read comment likes" ON public.comment_likes;
CREATE POLICY "comment_likes_select_visible_thread" ON public.comment_likes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.comments co
      WHERE co.id = comment_likes.comment_id
        AND public.card_is_visible(co.roadmap_id)
    )
  );

DROP POLICY IF EXISTS "Любой аутентифицированный может смотреть дизлайки" ON public.comment_dislikes;
DROP POLICY IF EXISTS "Anyone can read comment dislikes" ON public.comment_dislikes;
CREATE POLICY "comment_dislikes_select_visible_thread" ON public.comment_dislikes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.comments co
      WHERE co.id = comment_dislikes.comment_id
        AND public.card_is_visible(co.roadmap_id)
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert own likes" ON public.comment_likes;
CREATE POLICY "comment_likes_insert_own_visible_thread" ON public.comment_likes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.comments co
      WHERE co.id = comment_likes.comment_id
        AND public.card_is_visible(co.roadmap_id)
    )
  );

DROP POLICY IF EXISTS "Пользователь ставит дизлайк сам" ON public.comment_dislikes;
DROP POLICY IF EXISTS "Users can insert own comment dislikes" ON public.comment_dislikes;
CREATE POLICY "comment_dislikes_insert_own_visible_thread" ON public.comment_dislikes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.comments co
      WHERE co.id = comment_dislikes.comment_id
        AND public.card_is_visible(co.roadmap_id)
    )
  );

-- ─── likes / ratings (карточка) ───────────────────────────────────────────
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.likes;
CREATE POLICY "likes_select_visible_card" ON public.likes
  FOR SELECT USING (public.card_is_visible(card_id));

DROP POLICY IF EXISTS "ratings_select" ON public.ratings;
CREATE POLICY "ratings_select_visible_card" ON public.ratings
  FOR SELECT USING (public.card_is_visible(roadmap_id));

-- Запись в likes/ratings только по карточке, к которой есть право чтения (иначе INSERT по UUID приватной карты).
DROP POLICY IF EXISTS "likes_insert_not_own_card" ON public.likes;
CREATE POLICY "likes_insert_not_own_card" ON public.likes
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.card_is_visible(card_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = card_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ratings_insert" ON public.ratings;
DROP POLICY IF EXISTS "ratings_update" ON public.ratings;
CREATE POLICY "ratings_insert" ON public.ratings
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.card_is_visible(roadmap_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = roadmap_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "ratings_update" ON public.ratings
  FOR UPDATE USING (
    auth.uid() = user_id
    AND public.card_is_visible(roadmap_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.card_is_visible(roadmap_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = roadmap_id AND c.user_id = auth.uid()
    )
  );

-- ─── card_collaborators (раньше: select using true — утечка email) ─────────
DROP POLICY IF EXISTS "collab_select" ON public.card_collaborators;
CREATE POLICY "collab_select_visible_card" ON public.card_collaborators
  FOR SELECT USING (public.card_is_visible(card_id));

-- ─── steps (если RLS не был настроен — включаем и задаём политики) ────────
ALTER TABLE public.steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "steps_select_visible_card" ON public.steps;
CREATE POLICY "steps_select_visible_card" ON public.steps
  FOR SELECT USING (public.card_is_visible(card_id));

DROP POLICY IF EXISTS "steps_insert_editable" ON public.steps;
CREATE POLICY "steps_insert_editable" ON public.steps
  FOR INSERT WITH CHECK (public.card_is_editable(card_id));

DROP POLICY IF EXISTS "steps_update_editable" ON public.steps;
CREATE POLICY "steps_update_editable" ON public.steps
  FOR UPDATE USING (public.card_is_editable(card_id))
  WITH CHECK (public.card_is_editable(card_id));

DROP POLICY IF EXISTS "steps_delete_editable" ON public.steps;
CREATE POLICY "steps_delete_editable" ON public.steps
  FOR DELETE USING (public.card_is_editable(card_id));

-- ─── resources ────────────────────────────────────────────────────────────
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resources_select_visible_card" ON public.resources;
CREATE POLICY "resources_select_visible_card" ON public.resources
  FOR SELECT USING (public.card_is_visible(card_id));

DROP POLICY IF EXISTS "resources_insert_editable" ON public.resources;
CREATE POLICY "resources_insert_editable" ON public.resources
  FOR INSERT WITH CHECK (public.card_is_editable(card_id));

DROP POLICY IF EXISTS "resources_update_editable" ON public.resources;
CREATE POLICY "resources_update_editable" ON public.resources
  FOR UPDATE USING (public.card_is_editable(card_id))
  WITH CHECK (public.card_is_editable(card_id));

DROP POLICY IF EXISTS "resources_delete_editable" ON public.resources;
CREATE POLICY "resources_delete_editable" ON public.resources
  FOR DELETE USING (public.card_is_editable(card_id));

-- ─── gantt_tasks: is_private IS NULL считать публичным (как у cards) ───────
DROP POLICY IF EXISTS "gantt_tasks_select_by_card_access" ON public.gantt_tasks;
CREATE POLICY "gantt_tasks_select_by_card_access" ON public.gantt_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.cards c
      WHERE c.id = gantt_tasks.card_id
        AND (
          c.is_private = false
          OR c.is_private IS NULL
          OR c.user_id = auth.uid()
          OR (
            auth.email() IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.card_collaborators cc
              WHERE cc.card_id = c.id
                AND cc.user_email = auth.email()
            )
          )
        )
    )
  );
