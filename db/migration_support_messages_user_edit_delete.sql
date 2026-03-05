-- Позволяет пользователям редактировать свои сообщения в поддержке
CREATE POLICY "Users can update own support messages"
  ON support_messages
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Позволяет пользователям удалять свои сообщения в поддержке
CREATE POLICY "Users can delete own support messages"
  ON support_messages
  FOR DELETE
  USING (auth.uid() = user_id);
