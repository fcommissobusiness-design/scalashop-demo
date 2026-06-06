
-- Restrict Realtime channel subscriptions: each user can only subscribe to their own topic
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only subscribe to their own user_state channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('user_state:' || auth.uid()::text)
);
