ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access own user_state channel" ON realtime.messages;

CREATE POLICY "Users can only access own user_state channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() = ('user_state:' || auth.uid()::text))
);